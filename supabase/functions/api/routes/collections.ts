import { createServiceClient, getUser } from '../../_shared/supabase.ts'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../../_shared/response.ts'

export async function handleCollectionRoutes(req: Request, path: string): Promise<Response> {
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

  // GET collections/all
  if (path === 'collections/all') {
    return await getAllCollections(req, service, userId)
  }

  // PUT collections/merge
  if (path === 'collections/merge' && req.method === 'PUT') {
    return await mergeCollections(req, service, userId)
  }

  // PUT collections/clean
  if (path === 'collections/clean' && req.method === 'PUT') {
    return await cleanCollections(req, service, userId)
  }

  // GET collections/covers/{query}
  if (path.startsWith('collections/covers/')) {
    return jsonResponse({ result: true, items: [] }, req)
  }

  // PUT/DEL collections (bulk)
  if (path === 'collections') {
    if (req.method === 'PUT') return await bulkUpdateCollections(req, service, userId)
    if (req.method === 'DELETE') return await bulkDeleteCollections(req, service, userId)
  }

  // collection/{id}/lastAction
  const lastActionMatch = path.match(/^collection\/(-?\d+)\/lastAction$/)
  if (lastActionMatch) {
    return await getLastAction(req, service, userId, parseInt(lastActionMatch[1]))
  }

  // collection/{id}/sharing (stub)
  const sharingMatch = path.match(/^collection\/(-?\d+)\/sharing/)
  if (sharingMatch) {
    return jsonResponse({ result: true, items: [] }, req)
  }

  // PUT collection/{id}/cover
  const coverMatch = path.match(/^collection\/(-?\d+)\/cover$/)
  if (coverMatch && req.method === 'PUT') {
    return await uploadCollectionCover(req, service, userId, user.id, parseInt(coverMatch[1]))
  }

  // collection/{id}
  const idMatch = path.match(/^collection\/(-?\d+)$/)
  if (idMatch) {
    const id = parseInt(idMatch[1])
    if (req.method === 'GET') return await getCollection(req, service, userId, id)
    if (req.method === 'PUT') return await updateCollection(req, service, userId, id)
    if (req.method === 'DELETE') return await deleteCollection(req, service, userId, id)
  }

  // POST collection (create)
  if (path === 'collection' && req.method === 'POST') {
    return await createCollection(req, service, userId)
  }

  return errorResponse(req, 404, 'not_found', `Collection route not found: ${path}`)
}

function formatCollection(row: Record<string, unknown>, userId: number) {
  return {
    _id: row._id,
    title: row.title ?? '',
    color: row.color ?? '',
    cover: row.cover ?? [],
    view: row.view ?? 'list',
    public: row.public ?? false,
    expanded: row.expanded ?? false,
    sort: row.sort ?? 0,
    count: row.count ?? 0,
    created: row.created,
    lastUpdate: row.last_update,
    ...(row.parent_id ? { parent: { '$id': row.parent_id } } : {}),
    user: { '$id': row.user_id },
    access: {
      level: row.user_id === userId ? 4 : 1,
      draggable: row.user_id === userId,
    },
    author: row.user_id === userId,
  }
}

async function getAllCollections(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number
): Promise<Response> {
  const { data, error } = await service
    .from('collections')
    .select('*')
    .eq('user_id', userId)
    .order('sort', { ascending: true })

  if (error) return errorResponse(req, 500, 'db_error', error.message)

  const items = (data ?? []).map((row) => formatCollection(row, userId))

  return jsonResponse({ result: true, items }, req)
}

async function getCollection(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  id: number
): Promise<Response> {
  const { data, error } = await service
    .from('collections')
    .select('*')
    .eq('_id', id)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return errorResponse(req, 404, 'not_found', 'Collection not found')
  }

  return jsonResponse({ result: true, item: formatCollection(data, userId) }, req)
}

async function createCollection(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number
): Promise<Response> {
  const body = await req.json()

  const insert: Record<string, unknown> = {
    user_id: userId,
    title: body.title ?? '',
    view: body.view ?? 'list',
    public: body.public ?? false,
    sort: body.sort ?? body.order ?? 0,
  }

  if (body['parent.$id']) insert.parent_id = body['parent.$id']
  if (body.parentId && body.parentId !== 'root') insert.parent_id = body.parentId
  if (body.cover) insert.cover = Array.isArray(body.cover) ? body.cover : [body.cover]
  if (body.color) insert.color = body.color

  const { data, error } = await service
    .from('collections')
    .insert(insert)
    .select()
    .single()

  if (error) return errorResponse(req, 400, 'create_failed', error.message)

  return jsonResponse({ result: true, item: formatCollection(data, userId) }, req)
}

async function updateCollection(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  id: number
): Promise<Response> {
  const body = await req.json()
  const updates: Record<string, unknown> = {}

  if (body.title !== undefined) updates.title = body.title
  if (body.view !== undefined) updates.view = body.view
  if (body.public !== undefined) updates.public = body.public
  if (body.expanded !== undefined) updates.expanded = body.expanded
  if (body.sort !== undefined) updates.sort = body.sort
  if (body.order !== undefined) updates.sort = body.order
  if (body.color !== undefined) updates.color = body.color
  if (body.cover !== undefined) {
    updates.cover = Array.isArray(body.cover) ? body.cover : [body.cover]
  }
  if (body['parent.$id'] !== undefined) updates.parent_id = body['parent.$id'] || null
  if (body.parentId !== undefined) {
    updates.parent_id = body.parentId === 'root' ? null : body.parentId
  }

  if (Object.keys(updates).length === 0) {
    return errorResponse(req, 400, 'no_changes', 'No fields to update')
  }

  // Zyklus-Pruefung: Neuer Parent darf nicht in den Descendants liegen
  if (updates.parent_id !== undefined && updates.parent_id !== null) {
    const newParent = updates.parent_id as number
    if (newParent === id) {
      return errorResponse(req, 400, 'circular_reference', 'Collection cannot be its own parent')
    }
    const descendants = await getDescendantIds(service, userId, id)
    if (descendants.includes(newParent)) {
      return errorResponse(req, 400, 'circular_reference', 'Cannot move collection under its own descendant')
    }
  }

  const { data, error } = await service
    .from('collections')
    .update(updates)
    .eq('_id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) return errorResponse(req, 400, 'update_failed', error.message)
  if (!data) return errorResponse(req, 404, 'not_found', 'Collection not found')

  return jsonResponse({ result: true, item: formatCollection(data, userId) }, req)
}

async function deleteCollection(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  id: number
): Promise<Response> {
  // Trash leeren
  if (id === -99) {
    await service
      .from('raindrops')
      .delete()
      .eq('collection_id', -99)
      .eq('user_id', userId)
    return jsonResponse({ result: true }, req)
  }

  // Raindrops dieser Collection (und Kinder) nach Trash verschieben
  const childIds = await getDescendantIds(service, userId, id)
  const allIds = [id, ...childIds]

  await service
    .from('raindrops')
    .update({ collection_id: -99 })
    .in('collection_id', allIds)
    .eq('user_id', userId)

  // Collection und Kinder loeschen (CASCADE)
  const { error } = await service
    .from('collections')
    .delete()
    .eq('_id', id)
    .eq('user_id', userId)

  if (error) return errorResponse(req, 400, 'delete_failed', error.message)

  return jsonResponse({ result: true }, req)
}

async function bulkUpdateCollections(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number
): Promise<Response> {
  const body = await req.json()

  // expand/collapse all
  if (body.expanded !== undefined) {
    await service
      .from('collections')
      .update({ expanded: body.expanded })
      .eq('user_id', userId)
    return jsonResponse({ result: true }, req)
  }

  // reorder all
  if (body.sort) {
    const orderField = body.sort.replace('-', '')
    const ascending = !body.sort.startsWith('-')

    const { data } = await service
      .from('collections')
      .select('_id')
      .eq('user_id', userId)
      .order(orderField === 'count' ? 'count' : 'title', { ascending })

    if (data) {
      for (let i = 0; i < data.length; i++) {
        await service
          .from('collections')
          .update({ sort: i })
          .eq('_id', data[i]._id)
      }
    }
    return jsonResponse({ result: true }, req)
  }

  // change view for all
  if (body.view) {
    await service
      .from('collections')
      .update({ view: body.view })
      .eq('user_id', userId)
    return jsonResponse({ result: true }, req)
  }

  return jsonResponse({ result: true }, req)
}

async function bulkDeleteCollections(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number
): Promise<Response> {
  const body = await req.json()
  const ids: number[] = body.ids ?? []

  if (!ids.length) {
    return errorResponse(req, 400, 'missing_ids', 'No collection IDs provided')
  }

  for (const id of ids) {
    await service
      .from('raindrops')
      .update({ collection_id: -99 })
      .eq('collection_id', id)
      .eq('user_id', userId)

    await service
      .from('collections')
      .delete()
      .eq('_id', id)
      .eq('user_id', userId)
  }

  return jsonResponse({ result: true }, req)
}

async function mergeCollections(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number
): Promise<Response> {
  const { to, ids } = await req.json()

  if (!to || !ids?.length) {
    return errorResponse(req, 400, 'missing_fields', 'to and ids are required')
  }

  for (const srcId of ids) {
    if (srcId === to) continue

    await service
      .from('raindrops')
      .update({ collection_id: to })
      .eq('collection_id', srcId)
      .eq('user_id', userId)

    await service
      .from('collections')
      .delete()
      .eq('_id', srcId)
      .eq('user_id', userId)
  }

  return jsonResponse({ result: true }, req)
}

async function cleanCollections(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number
): Promise<Response> {
  const { data } = await service
    .from('collections')
    .select('_id, count')
    .eq('user_id', userId)
    .eq('count', 0)

  const emptyIds = (data ?? []).map((c) => c._id)

  // nur loeschen wenn auch keine Kinder vorhanden
  let deleted = 0
  for (const id of emptyIds) {
    const { data: children } = await service
      .from('collections')
      .select('_id')
      .eq('parent_id', id)
      .limit(1)

    if (!children?.length) {
      await service.from('collections').delete().eq('_id', id).eq('user_id', userId)
      deleted++
    }
  }

  return jsonResponse({ result: true, count: deleted }, req)
}

async function getLastAction(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  collectionId: number
): Promise<Response> {
  // Freshness-Check: return last_update of collection or global
  if (collectionId > 0) {
    const { data } = await service
      .from('collections')
      .select('last_update')
      .eq('_id', collectionId)
      .eq('user_id', userId)
      .single()

    return jsonResponse({
      result: true,
      lastAction: data?.last_update ?? new Date().toISOString(),
      version: 1,
    }, req)
  }

  // system collection: return now
  return jsonResponse({
    result: true,
    lastAction: new Date().toISOString(),
    version: 1,
  }, req)
}

async function uploadCollectionCover(
  req: Request,
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  authUid: string,
  collectionId: number
): Promise<Response> {
  const formData = await req.formData().catch(() => null)
  if (!formData) return errorResponse(req, 400, '-1', 'no file')

  const file = formData.get('cover') as File | null
  if (!file) return errorResponse(req, 400, '-1', 'no file')

  const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return errorResponse(req, 400, 'file_invalid', 'File is invalid')
  }

  if (file.size > 10 * 1024 * 1024) {
    return errorResponse(req, 400, 'file_size_limit', 'File size limit')
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const storagePath = `${authUid}/collection-${collectionId}.${ext}`

  const { error: uploadError } = await service.storage
    .from('raindrop-covers')
    .upload(storagePath, file, { contentType: file.type, upsert: true })

  if (uploadError) {
    return errorResponse(req, 400, 'file_invalid', uploadError.message)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const coverUrl = `${supabaseUrl}/storage/v1/object/public/raindrop-covers/${storagePath}`

  const { data, error } = await service
    .from('collections')
    .update({ cover: [coverUrl] })
    .eq('_id', collectionId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error || !data) {
    return errorResponse(req, 400, 'update_failed', error?.message ?? 'Collection not found')
  }

  return jsonResponse({ result: true, item: formatCollection(data, userId) }, req)
}

async function getDescendantIds(
  service: ReturnType<typeof createServiceClient>,
  userId: number,
  parentId: number
): Promise<number[]> {
  const { data } = await service
    .from('collections')
    .select('_id')
    .eq('parent_id', parentId)
    .eq('user_id', userId)

  if (!data?.length) return []

  const ids = data.map((c) => c._id)
  const nested = await Promise.all(
    ids.map((id) => getDescendantIds(service, userId, id))
  )
  return [...ids, ...nested.flat()]
}
