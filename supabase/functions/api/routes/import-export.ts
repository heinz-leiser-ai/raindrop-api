import { createServiceClient, getUser } from '../../_shared/supabase.ts'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../../_shared/response.ts'

export async function handleImportExportRoutes(req: Request, path: string): Promise<Response> {
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

  // POST|PUT import/file
  if (path === 'import/file' && (req.method === 'POST' || req.method === 'PUT')) {
    return await importFile(req)
  }

  // POST import/url/exists
  if (path === 'import/url/exists' && req.method === 'POST') {
    return await checkUrlExists(req, service, userId)
  }

  // GET raindrops/{collectionId}/export.{format}
  const exportMatch = path.match(/^raindrops\/(-?\d+)\/export\.(csv|html|zip)$/)
  if (exportMatch && req.method === 'GET') {
    return await exportRaindrops(req, service, userId, parseInt(exportMatch[1]), exportMatch[2])
  }

  return errorResponse(req, 404, 'not_found', `Import/Export route not found: ${path}`)
}

async function importFile(req: Request): Promise<Response> {
  const formData = await req.formData().catch(() => null)
  if (!formData) return errorResponse(req, 400, '-1', 'no file')

  const file = formData.get('import') as File | null
  if (!file) return errorResponse(req, 400, '-1', 'no file')

  const html = await file.text()
  const items = parseNetscapeBookmarks(html)

  return jsonResponse({
    result: true,
    items,
    count: countBookmarks(items),
  }, req)
}

async function checkUrlExists(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number
): Promise<Response> {
  const body = await req.json()
  const urls: string[] = body.urls ?? []

  if (!urls.length) {
    return jsonResponse({ result: false, ids: [], duplicates: [] }, req)
  }

  const { data } = await service
    .from('raindrops')
    .select('_id, link')
    .eq('user_id', userId)
    .in('link', urls.slice(0, 500))

  const ids = (data ?? []).map((r) => r._id)
  const duplicates = (data ?? []).map((r) => ({ _id: r._id, link: r.link }))

  return jsonResponse({
    result: ids.length > 0,
    ids,
    duplicates,
  }, req)
}

async function exportRaindrops(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  collectionId: number,
  format: string
): Promise<Response> {
  const url = new URL(req.url)
  const search = url.searchParams.get('search') ?? ''
  const sort = url.searchParams.get('sort') ?? '-created'

  let query = service
    .from('raindrops')
    .select('*')
    .eq('user_id', userId)

  if (collectionId === 0) {
    query = query.neq('collection_id', -99)
  } else {
    query = query.eq('collection_id', collectionId)
  }

  if (search) {
    query = query.textSearch('search_vector', search.split(/\s+/).join(' & '), { type: 'plain' })
  }

  const desc = sort.startsWith('-')
  const sortField = sort.replace(/^-/, '')
  const fieldMap: Record<string, string> = { created: 'created', title: 'title', domain: 'domain', sort: 'order' }
  query = query.order(fieldMap[sortField] ?? 'created', { ascending: !desc })
  query = query.limit(10000)

  const { data } = await query

  const items = data ?? []

  if (format === 'csv') {
    const csvLines = ['title,link,tags,created,collection_id,type,excerpt']
    for (const r of items) {
      const tags = (r.tags ?? []).join('; ')
      const row = [r.title, r.link, tags, r.created, r.collection_id, r.type, r.excerpt]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
      csvLines.push(row)
    }
    return new Response(csvLines.join('\n'), {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="export.csv"' },
    })
  }

  if (format === 'html') {
    const htmlLines = [
      '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
      '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
      '<TITLE>Bookmarks</TITLE>',
      '<H1>Bookmarks</H1>',
      '<DL><p>',
    ]
    for (const r of items) {
      const ts = Math.floor(new Date(r.created).getTime() / 1000)
      const tags = (r.tags ?? []).join(',')
      htmlLines.push(`  <DT><A HREF="${r.link}" ADD_DATE="${ts}" TAGS="${tags}">${r.title ?? ''}</A>`)
      if (r.excerpt) htmlLines.push(`  <DD>${r.excerpt}`)
    }
    htmlLines.push('</DL><p>')
    return new Response(htmlLines.join('\n'), {
      headers: { 'Content-Type': 'text/html', 'Content-Disposition': 'attachment; filename="export.html"' },
    })
  }

  // zip: return JSON as fallback
  return jsonResponse({ result: true, items: items.map(formatExportItem) }, req)
}

function formatExportItem(r: Record<string, unknown>) {
  return {
    _id: r._id,
    link: r.link,
    title: r.title,
    excerpt: r.excerpt,
    tags: r.tags,
    type: r.type,
    created: r.created,
    collectionId: r.collection_id,
  }
}

// ─── Netscape Bookmark Parser ────────────────────────────

function parseNetscapeBookmarks(html: string): ImportFolder[] {
  const lines = html.split('\n')
  const root: ImportFolder[] = []
  const stack: ImportFolder[] = []
  let current: ImportFolder = { title: 'Root', folders: [], bookmarks: [] }
  root.push(current)

  for (const line of lines) {
    const trimmed = line.trim()

    // Folder start
    const folderMatch = trimmed.match(/<H3[^>]*>([^<]+)<\/H3>/i)
    if (folderMatch) {
      const folder: ImportFolder = { title: folderMatch[1], folders: [], bookmarks: [] }
      current.folders.push(folder)
      stack.push(current)
      current = folder
      continue
    }

    // Folder end
    if (trimmed === '</DL><p>' || trimmed === '</DL>') {
      const parent = stack.pop()
      if (parent) current = parent
      continue
    }

    // Bookmark
    const bmMatch = trimmed.match(/<A\s+HREF="([^"]+)"[^>]*>([^<]*)<\/A>/i)
    if (bmMatch) {
      const link = bmMatch[1]
      const title = bmMatch[2]
      const tagsMatch = trimmed.match(/TAGS="([^"]*)"/i)
      const dateMatch = trimmed.match(/ADD_DATE="(\d+)"/i)
      const tags = tagsMatch?.[1]?.split(',').filter(Boolean) ?? []
      const lastUpdate = dateMatch ? new Date(parseInt(dateMatch[1]) * 1000).toISOString() : new Date().toISOString()

      current.bookmarks.push({ link, title, tags, lastUpdate, excerpt: '' })
      continue
    }

    // Description after bookmark
    const ddMatch = trimmed.match(/<DD>(.*)/i)
    if (ddMatch && current.bookmarks.length) {
      current.bookmarks[current.bookmarks.length - 1].excerpt = ddMatch[1]
    }
  }

  return root
}

function countBookmarks(items: ImportFolder[]): number {
  let count = 0
  for (const item of items) {
    count += item.bookmarks.length
    count += countBookmarks(item.folders)
  }
  return count
}

interface ImportFolder {
  title: string
  folders: ImportFolder[]
  bookmarks: { link: string; title: string; tags: string[]; lastUpdate: string; excerpt: string }[]
}
