import { createServiceClient, getUser } from '../../_shared/supabase.ts'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../../_shared/response.ts'

export async function handleBackupRoutes(req: Request, path: string): Promise<Response> {
  if (req.method !== 'GET') return errorResponse(req, 405, 'method_not_allowed')

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

  // GET backups (list)
  if (path === 'backups') {
    return await listBackups(req, service, userId)
  }

  // GET backup (create new)
  if (path === 'backup') {
    return await createBackup(req, service, userId)
  }

  // GET backup/{id}.{format}
  const downloadMatch = path.match(/^backup\/([^.]+)\.(csv|html)$/)
  if (downloadMatch) {
    return await downloadBackup(req, service, userId, downloadMatch[1], downloadMatch[2])
  }

  return errorResponse(req, 404, 'not_found', `Backup route not found: ${path}`)
}

async function listBackups(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number
): Promise<Response> {
  const { data } = await service
    .from('backups')
    .select('_id, created, status, format')
    .eq('user_id', userId)
    .order('created', { ascending: false })

  return jsonResponse({
    result: true,
    items: (data ?? []).map((b) => ({
      _id: b._id,
      created: b.created,
      status: b.status,
      format: b.format,
    })),
  }, req)
}

async function createBackup(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number
): Promise<Response> {
  // Load all user raindrops
  const { data: raindrops } = await service
    .from('raindrops')
    .select('*')
    .eq('user_id', userId)
    .neq('collection_id', -99)
    .order('created', { ascending: false })

  const items = raindrops ?? []

  // Generate HTML export
  const htmlLines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Raindrop Backup</TITLE>',
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
  const htmlContent = htmlLines.join('\n')

  // Store backup file in storage
  const backupId = crypto.randomUUID()
  const storagePath = `${userId}/${backupId}.html`

  await service.storage
    .from('raindrop-files')
    .upload(storagePath, new Blob([htmlContent], { type: 'text/html' }), {
      contentType: 'text/html',
      upsert: false,
    })

  // Create backup record
  await service.from('backups').insert({
    _id: backupId,
    user_id: userId,
    format: 'html',
    storage_path: storagePath,
    status: 'ready',
  })

  return jsonResponse({ result: true, _id: backupId }, req)
}

async function downloadBackup(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  backupId: string,
  format: string
): Promise<Response> {
  const { data: backup } = await service
    .from('backups')
    .select('storage_path, status')
    .eq('_id', backupId)
    .eq('user_id', userId)
    .single()

  if (!backup || backup.status !== 'ready' || !backup.storage_path) {
    return errorResponse(req, 404, 'not_found', 'Backup not found or not ready')
  }

  // If requested format matches stored format, serve from storage
  const { data: fileData } = await service.storage
    .from('raindrop-files')
    .download(backup.storage_path)

  if (!fileData) {
    return errorResponse(req, 404, 'not_found', 'Backup file not found')
  }

  const content = await fileData.text()

  if (format === 'csv') {
    // Convert HTML backup to CSV on-the-fly
    const csvLines = ['title,link,tags,created']
    const linkRegex = /<A HREF="([^"]+)"[^>]*ADD_DATE="(\d+)"[^>]*TAGS="([^"]*)"[^>]*>([^<]*)<\/A>/gi
    let match
    while ((match = linkRegex.exec(content)) !== null) {
      const row = [match[4], match[1], match[3].replace(/,/g, '; '), new Date(parseInt(match[2]) * 1000).toISOString()]
        .map((v) => `"${v.replace(/"/g, '""')}"`)
        .join(',')
      csvLines.push(row)
    }
    return new Response(csvLines.join('\n'), {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="backup-${backupId}.csv"` },
    })
  }

  return new Response(content, {
    headers: { 'Content-Type': 'text/html', 'Content-Disposition': `attachment; filename="backup-${backupId}.html"` },
  })
}
