/// <reference path="./esm-url-shims.d.ts" />
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getEnv } from './env.ts'

const SUPABASE_URL = getEnv('SUPABASE_URL')!
const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY')!
const RAINDROP_SERVICE_ROLE_KEY = getEnv('RAINDROP_SERVICE_ROLE_KEY')!

export function createAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

export function createServiceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, RAINDROP_SERVICE_ROLE_KEY)
}

export function createUserClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization')
  const cookies = req.headers.get('cookie') ?? ''

  const accessToken = authHeader?.replace('Bearer ', '') ??
    extractCookieValue(cookies, 'sb-access-token') ??
    extractCookieValue(cookies, 'sb:token')

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  })
}

export async function getUser(req: Request) {
  const client = createUserClient(req)
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) return null
  return user
}

export async function getProfile(req: Request) {
  const user = await getUser(req)
  if (!user) return null

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  return {
    _id: profile.integer_id,
    email: user.email,
    name: profile.full_name ?? '',
    avatar: profile.avatar ?? '',
    pro: true,
    config: profile.config ?? {},
    groups: profile.groups ?? [],
    registered: profile.created_at,
  }
}

function extractCookieValue(cookies: string, name: string): string | null {
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}
