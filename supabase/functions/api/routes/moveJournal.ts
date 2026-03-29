import { createServiceClient, getUser } from '../../_shared/supabase.ts'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../../_shared/response.ts'

export async function handleMoveJournalRoutes(req: Request, path: string): Promise<Response> {
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

  // GET move-journal
  if (path === 'move-journal' && req.method === 'GET') {
    return await getJournal(req, service, userId)
  }

  // DELETE move-journal
  if (path === 'move-journal' && req.method === 'DELETE') {
    return await clearJournal(req, service, userId)
  }

  // POST move-journal/undo/{id}
  const undoMatch = path.match(/^move-journal\/undo\/(\d+)$/)
  if (undoMatch && req.method === 'POST') {
    return await undoEntry(req, service, userId, parseInt(undoMatch[1]))
  }

  return errorResponse(req, 404, 'not_found', `Move-journal route not found: ${path}`)
}

// ─── GET Journal (paginated) ─────────────────────────────

async function getJournal(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number
): Promise<Response> {
  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') ?? '0')
  const perpage = Math.min(parseInt(url.searchParams.get('perpage') ?? '50'), 100)

  const from = page * perpage
  const to = from + perpage

  const { data, count, error } = await service
    .from('move_journal')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to - 1)

  if (error) return errorResponse(req, 500, 'db_error', error.message)

  const items = (data ?? []).map(formatEntry)
  const total = count ?? 0

  return jsonResponse({
    result: true,
    items,
    count: total,
    hasMore: from + items.length < total,
  }, req)
}

// ─── DELETE Journal ──────────────────────────────────────

async function clearJournal(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number
): Promise<Response> {
  const { error } = await service
    .from('move_journal')
    .delete()
    .eq('user_id', userId)

  if (error) return errorResponse(req, 500, 'db_error', error.message)

  return jsonResponse({ result: true }, req)
}

// ─── POST Undo ───────────────────────────────────────────

async function undoEntry(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  entryId: number
): Promise<Response> {
  const { data: entry, error: fetchError } = await service
    .from('move_journal')
    .select('*')
    .eq('id', entryId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !entry) {
    return errorResponse(req, 404, 'not_found', 'Journal entry not found')
  }

  if (entry.undone) {
    return jsonResponse({ result: true, already_undone: true }, req)
  }

  if (entry.action === 'create' || entry.action === 'restore') {
    return errorResponse(req, 400, 'not_undoable', 'Create and restore actions cannot be undone')
  }

  if (entry.from_collection_id === null) {
    return errorResponse(req, 400, 'no_source', 'No source collection to revert to')
  }

  if (entry.object_type === 'bookmark') {
    const { data: existing } = await service
      .from('raindrops')
      .select('_id')
      .eq('_id', entry.object_id)
      .eq('user_id', userId)
      .single()

    if (!existing) {
      return errorResponse(req, 404, 'object_gone', 'Bookmark existiert nicht mehr')
    }

    if (entry.from_collection_id > 0) {
      const { data: col } = await service
        .from('collections')
        .select('_id')
        .eq('_id', entry.from_collection_id)
        .eq('user_id', userId)
        .single()

      if (!col) {
        return errorResponse(req, 404, 'collection_gone', 'Ziel-Collection existiert nicht mehr')
      }
    }

    await service
      .from('raindrops')
      .update({ collection_id: entry.from_collection_id })
      .eq('_id', entry.object_id)
      .eq('user_id', userId)

  } else if (entry.object_type === 'collection') {
    const { data: existing } = await service
      .from('collections')
      .select('_id')
      .eq('_id', entry.object_id)
      .eq('user_id', userId)
      .single()

    if (!existing) {
      return errorResponse(req, 404, 'object_gone', 'Collection existiert nicht mehr')
    }

    const revertParentId = (entry.from_collection_id && entry.from_collection_id > 0)
      ? entry.from_collection_id
      : null

    await service
      .from('collections')
      .update({ parent_id: revertParentId })
      .eq('_id', entry.object_id)
      .eq('user_id', userId)
  }

  await service
    .from('move_journal')
    .update({ undone: true })
    .eq('id', entryId)

  const fromName = entry.to_collection_name || ''
  const toName = entry.from_collection_name || ''

  await service.from('move_journal').insert({
    user_id: userId,
    action: 'move',
    object_type: entry.object_type,
    object_id: entry.object_id,
    object_title: entry.object_title,
    from_collection_id: entry.to_collection_id,
    from_collection_name: fromName,
    to_collection_id: entry.from_collection_id,
    to_collection_name: toName,
  })

  return jsonResponse({ result: true }, req)
}

// ─── Helpers ─────────────────────────────────────────────

function formatEntry(row: Record<string, unknown>) {
  return {
    id: row.id,
    action: row.action,
    object_type: row.object_type,
    object_id: row.object_id,
    object_title: row.object_title,
    from_collection_id: row.from_collection_id,
    from_collection_name: row.from_collection_name,
    to_collection_id: row.to_collection_id,
    to_collection_name: row.to_collection_name,
    undone: row.undone,
    batch_id: row.batch_id,
    created_at: row.created_at,
  }
}

// ─── Shared: write journal entries (used by raindrops.ts / collections.ts) ───

export async function writeMoveJournal(
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  entry: {
    action: string
    object_type: string
    object_id: number
    object_title: string
    from_collection_id: number | null
    from_collection_name: string
    to_collection_id: number | null
    to_collection_name: string
    batch_id?: string
  }
) {
  await service.from('move_journal').insert({
    user_id: userId,
    ...entry,
  }).then(() => {})
}

export async function resolveCollectionName(
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  collectionId: number | null | undefined
): Promise<string> {
  if (collectionId === null || collectionId === undefined) return ''
  if (collectionId === 0) return 'All'
  if (collectionId === -1) return 'Unsorted'
  if (collectionId === -99) return 'Trash'

  const { data } = await service
    .from('collections')
    .select('title')
    .eq('_id', collectionId)
    .eq('user_id', userId)
    .single()

  return data?.title ?? ''
}
