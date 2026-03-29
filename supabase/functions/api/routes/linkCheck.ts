import { createServiceClient, getUser } from '../../_shared/supabase.ts'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../../_shared/response.ts'

const BATCH_SIZE = 5
const BATCH_DELAY_MS = 200
const REQUEST_TIMEOUT_MS = 10000
const STALE_RUN_MINUTES = 30
const USER_AGENT = 'Mozilla/5.0 (compatible; RaindropLinkChecker/1.0)'

export async function handleLinkCheckRoutes(req: Request, path: string): Promise<Response> {
  const user = await getUser(req)
  if (!user) return unauthorizedResponse(req)

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('integer_id')
    .eq('id', user.id)
    .single()

  if (!profile) return unauthorizedResponse(req)
  const userId = profile.integer_id

  const url = new URL(req.url)

  if (path === 'link-check/start' && req.method === 'POST') {
    return await startCheck(req, service, userId)
  }

  if (path === 'link-check/status' && req.method === 'GET') {
    const runId = url.searchParams.get('runId')
    return await getStatus(req, service, userId, runId ? parseInt(runId) : null)
  }

  if (path === 'link-check/journal' && req.method === 'GET') {
    return await getJournal(req, service, userId)
  }

  if (path === 'link-check/journal' && req.method === 'DELETE') {
    return await clearJournal(req, service, userId)
  }

  return errorResponse(req, 404, 'not_found', `Link-check route not found: ${path}`)
}

// ─── Start Check ─────────────────────────────────────────

async function startCheck(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number
): Promise<Response> {
  const { data: activeRun } = await service
    .from('link_check_runs')
    .select('id, started_at')
    .eq('user_id', userId)
    .eq('status', 'running')
    .limit(1)
    .single()

  if (activeRun) {
    const startedAt = new Date(activeRun.started_at).getTime()
    const staleAfter = STALE_RUN_MINUTES * 60 * 1000
    if (Date.now() - startedAt > staleAfter) {
      await service
        .from('link_check_runs')
        .update({ status: 'failed', finished_at: new Date().toISOString() })
        .eq('id', activeRun.id)
    } else {
      return errorResponse(req, 409, 'already_running', 'A link check is already running')
    }
  }

  const body = await req.json().catch(() => ({}))
  const brokenLevel: string = body.broken_level || 'default'
  const skipDays: number = parseInt(body.skip_days) || 0
  const collectionIds: number[] | undefined = Array.isArray(body.collection_ids) ? body.collection_ids.map(Number).filter(Boolean) : undefined

  if (brokenLevel === 'off') {
    return errorResponse(req, 400, 'disabled', 'Link checking is disabled')
  }

  let query = service
    .from('raindrops')
    .select('_id, link, collection_id')
    .eq('user_id', userId)
    .neq('collection_id', -99)
    .neq('link', '')

  if (collectionIds && collectionIds.length > 0) {
    query = query.in('collection_id', collectionIds)
  }

  if (skipDays > 0) {
    const cutoff = new Date(Date.now() - skipDays * 24 * 60 * 60 * 1000).toISOString()
    query = query.or(`last_checked.is.null,last_checked.lt.${cutoff}`)
  }

  const { data: bookmarks, error: loadError } = await query

  if (loadError) {
    return errorResponse(req, 500, 'db_error', loadError.message)
  }

  const total = bookmarks?.length ?? 0

  const { data: run, error: runError } = await service
    .from('link_check_runs')
    .insert({ user_id: userId, total, status: 'running' })
    .select('id')
    .single()

  if (runError || !run) {
    return errorResponse(req, 500, 'db_error', runError?.message ?? 'Failed to create run')
  }

  const bgPromise = processBookmarks(service, run.id, userId, bookmarks ?? [], brokenLevel)
  try {
    // @ts-ignore EdgeRuntime available in Supabase
    EdgeRuntime?.waitUntil?.(bgPromise)
  } catch {
    // Fallback: let the promise run
  }

  return jsonResponse({ result: true, runId: run.id, total }, req)
}

// ─── Background Processing ──────────────────────────────

async function processBookmarks(
  service: ReturnType<typeof createServiceClient>,
  runId: number,
  userId: number,
  bookmarks: Array<{ _id: number; link: string; collection_id: number }>,
  brokenLevel: string
) {
  let checked = 0
  let brokenCount = 0

  try {
    for (let i = 0; i < bookmarks.length; i += BATCH_SIZE) {
      const batch = bookmarks.slice(i, i + BATCH_SIZE)

      const results = await Promise.all(
        batch.map((b) => checkUrl(b.link, brokenLevel))
      )

      const now = new Date().toISOString()
      for (let j = 0; j < batch.length; j++) {
        const isBroken = results[j]
        await service
          .from('raindrops')
          .update({ broken: isBroken, last_checked: now })
          .eq('_id', batch[j]._id)
          .eq('user_id', userId)

        if (isBroken) brokenCount++
      }

      checked += batch.length

      await service
        .from('link_check_runs')
        .update({ checked, broken_count: brokenCount })
        .eq('id', runId)

      if (i + BATCH_SIZE < bookmarks.length) {
        await delay(BATCH_DELAY_MS)
      }
    }

    await service
      .from('link_check_runs')
      .update({ status: 'completed', checked, broken_count: brokenCount, finished_at: new Date().toISOString() })
      .eq('id', runId)
  } catch (err) {
    console.error('Link check failed:', err)
    await service
      .from('link_check_runs')
      .update({ status: 'failed', checked, broken_count: brokenCount, finished_at: new Date().toISOString() })
      .eq('id', runId)
  }
}

async function checkUrl(url: string, brokenLevel: string): Promise<boolean> {
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return false
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let res: Response
    try {
      res = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': USER_AGENT },
      })
    } catch {
      res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': USER_AGENT },
      })
    } finally {
      clearTimeout(timeout)
    }

    return isStatusBroken(res.status, brokenLevel)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return brokenLevel !== 'basic'
    }
    const msg = String(err?.message ?? '')
    if (msg.includes('certificate') || msg.includes('SSL') || msg.includes('TLS')) {
      return brokenLevel !== 'basic'
    }
    return true
  }
}

function isStatusBroken(status: number, brokenLevel: string): boolean {
  if (status === 404 || status === 410) return true
  if (status === 401 || status === 403) return false
  if (status >= 301 && status <= 308) return false
  if (status >= 200 && status < 400) return false
  if (status >= 500 && brokenLevel === 'strict') return true
  return false
}

// ─── Status ─────────────────────────────────────────────

async function getStatus(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  runId: number | null
): Promise<Response> {
  let query = service
    .from('link_check_runs')
    .select('*')
    .eq('user_id', userId)

  if (runId) {
    query = query.eq('id', runId)
  } else {
    query = query.order('started_at', { ascending: false }).limit(1)
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return jsonResponse({
      result: true,
      status: 'idle',
      total: 0,
      checked: 0,
      brokenCount: 0,
    }, req)
  }

  return jsonResponse({
    result: true,
    runId: data.id,
    status: data.status,
    total: data.total,
    checked: data.checked,
    brokenCount: data.broken_count,
    startedAt: data.started_at,
    finishedAt: data.finished_at,
  }, req)
}

// ─── Journal ────────────────────────────────────────────

async function getJournal(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number
): Promise<Response> {
  const { data, error } = await service
    .from('link_check_journal')
    .select('*')
    .eq('user_id', userId)
    .order('deleted_at', { ascending: false })
    .limit(500)

  if (error) {
    return errorResponse(req, 500, 'db_error', error.message)
  }

  const items = (data ?? []).map((row) => ({
    id: row.id,
    title: row.bookmark_title,
    url: row.url,
    collection_name: row.collection_name,
    deleted_at: row.deleted_at,
  }))

  return jsonResponse({ result: true, items }, req)
}

async function clearJournal(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number
): Promise<Response> {
  const { error } = await service
    .from('link_check_journal')
    .delete()
    .eq('user_id', userId)

  if (error) {
    return errorResponse(req, 500, 'db_error', error.message)
  }

  return jsonResponse({ result: true }, req)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
