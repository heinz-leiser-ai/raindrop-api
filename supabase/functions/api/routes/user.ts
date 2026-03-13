import { getUser, getProfile, createServiceClient, createUserClient } from '../../_shared/supabase.ts'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../../_shared/response.ts'

export async function handleUserRoutes(req: Request, path: string): Promise<Response> {
  switch (path) {
    case 'user':
      return await handleUser(req)
    case 'user/stats':
      return await handleUserStats(req)
    case 'user/subscription':
      return await handleSubscription(req)
    default:
      return errorResponse(req, 404, 'not_found', `User route not found: ${path}`)
  }
}

async function handleUser(req: Request): Promise<Response> {
  const profile = await getProfile(req)
  if (!profile) return unauthorizedResponse(req)

  if (req.method === 'GET') {
    return jsonResponse({ result: true, user: profile }, req)
  }

  if (req.method === 'PUT') {
    const body = await req.json()
    const user = await getUser(req)
    if (!user) return unauthorizedResponse(req)

    const service = createServiceClient()
    const updates: Record<string, unknown> = {}

    if (body.fullName !== undefined) updates.full_name = body.fullName
    if (body.config !== undefined) {
      updates.config = { ...profile.config, ...body.config }
    }
    if (body.groups !== undefined) updates.groups = body.groups

    const { data, error } = await service
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      return errorResponse(req, 400, 'update_failed', error.message)
    }

    const updatedProfile = await getProfile(req)
    return jsonResponse({ result: true, user: updatedProfile }, req)
  }

  return errorResponse(req, 405, 'method_not_allowed')
}

async function handleUserStats(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return errorResponse(req, 405, 'method_not_allowed')
  }

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

  // Total count across all user collections
  const { data: totalData } = await service
    .from('collections')
    .select('count')
    .eq('user_id', userId)
  const totalCount = (totalData ?? []).reduce((sum, c) => sum + (c.count ?? 0), 0)

  let unsortedCount = 0
  let trashCount = 0

  try {
    const { count: unsorted } = await service
      .from('raindrops')
      .select('*', { count: 'exact', head: true })
      .eq('collection_id', -1)
      .eq('user_id', userId)
    unsortedCount = unsorted ?? 0

    const { count: trash } = await service
      .from('raindrops')
      .select('*', { count: 'exact', head: true })
      .eq('collection_id', -99)
      .eq('user_id', userId)
    trashCount = trash ?? 0
  } catch {
    // raindrops table may not exist yet
  }

  const items = [
    { _id: 0, count: totalCount + unsortedCount },
    { _id: -1, count: unsortedCount },
    { _id: -99, count: trashCount },
  ]

  return jsonResponse({
    result: true,
    items,
    meta: {
      pro: false,
      _id: profile.integer_id,
      changedBookmarksDate: new Date().toISOString(),
    },
  }, req)
}

async function handleSubscription(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return errorResponse(req, 405, 'method_not_allowed')
  }

  const user = await getUser(req)
  if (!user) return unauthorizedResponse(req)

  // MVP: all self-hosted users get pro features
  return jsonResponse({
    result: true,
    plan: 'pro',
    active: true,
  }, req)
}
