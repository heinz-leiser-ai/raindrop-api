import { createAnonClient, createServiceClient, createUserClient, getUser } from '../../_shared/supabase.ts'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../../_shared/response.ts'
import { corsHeaders } from '../../_shared/cors.ts'

export async function handleAuthRoutes(req: Request, path: string): Promise<Response> {
  switch (path) {
    case 'auth/email/login':
      return await emailLogin(req)
    case 'auth/email/signup':
      return await emailSignup(req)
    case 'auth/email/lost':
      return await emailLost(req)
    case 'auth/email/recover':
      return await emailRecover(req)
    case 'auth/logout':
      return await logout(req)
    case 'auth/jwt':
      return await jwtLogin(req)
    default:
      if (path.match(/^auth\/\w+\/native/)) {
        return await oauthNative(req, path)
      }
      return errorResponse(req, 404, 'not_found', `Auth route not found: ${path}`)
  }
}

async function parseBody(req: Request): Promise<Record<string, string>> {
  const contentType = (req.headers.get('content-type') ?? '').toLowerCase()
  if (contentType.includes('application/json')) {
    return await req.json()
  }
  const text = await req.text()
  return Object.fromEntries(new URLSearchParams(text))
}

async function emailLogin(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return errorResponse(req, 405, 'method_not_allowed')
  }

  const body = await parseBody(req)
  const email = body.email
  const password = body.password
  if (!email || !password) {
    return errorResponse(req, 400, 'missing_fields', 'Email and password required')
  }

  const supabase = createAnonClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const ct = (req.headers.get('content-type') ?? '').toLowerCase()
    if (!ct.includes('application/json')) {
      const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:2000'
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${siteUrl}/account/login?error=${encodeURIComponent(error.message)}`,
          ...corsHeaders(req.headers.get('origin')),
        },
      })
    }
    return errorResponse(req, 401, 'unauthorized', error.message)
  }

  const origin = req.headers.get('origin')
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...corsHeaders(origin),
  })

  if (data.session) {
    const secure = Deno.env.get('COOKIE_SECURE') !== 'false'
    const domain = Deno.env.get('COOKIE_DOMAIN') ?? ''
    const domainAttr = domain ? `; Domain=${domain}` : ''

    const sameSite = Deno.env.get('COOKIE_SAMESITE') ?? 'None'
    headers.append(
      'Set-Cookie',
      `sb-access-token=${data.session.access_token}; Path=/; HttpOnly; SameSite=${sameSite}${sameSite === 'None' ? '; Secure' : (secure ? '; Secure' : '')}${domainAttr}; Max-Age=${data.session.expires_in}`
    )
    headers.append(
      'Set-Cookie',
      `sb-refresh-token=${data.session.refresh_token}; Path=/; HttpOnly; SameSite=${sameSite}${sameSite === 'None' ? '; Secure' : (secure ? '; Secure' : '')}${domainAttr}; Max-Age=604800`
    )
  }

  const contentType = (req.headers.get('content-type') ?? '').toLowerCase()
  const isFormSubmit = !contentType.includes('application/json')

  if (isFormSubmit) {
    const redirect = body.redirect || '/'
    const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:2000'
    headers.set('Location', `${siteUrl}${redirect.startsWith('/') ? '' : '/'}${redirect}`)
    return new Response(null, { status: 302, headers })
  }

  return new Response(JSON.stringify({ result: true }), { status: 200, headers })
}

async function emailSignup(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return errorResponse(req, 405, 'method_not_allowed')
  }

  // Admin-Auth: Nur authentifizierte Admins duerfen User anlegen
  const adminKey = Deno.env.get('ADMIN_API_KEY')
  const providedKey = req.headers.get('X-Admin-Key')

  if (!adminKey || providedKey !== adminKey) {
    // Fallback: Pruefe ob der aufrufende User selbst ein Admin ist (erster User)
    const caller = await getUser(req)
    if (!caller) {
      return errorResponse(req, 403, 'forbidden', 'Admin authentication required')
    }

    const service = createServiceClient()
    const { data: callerProfile } = await service
      .from('profiles')
      .select('integer_id')
      .eq('id', caller.id)
      .single()

    // Nur der erste registrierte User (integer_id = 1) darf weitere anlegen
    if (!callerProfile || callerProfile.integer_id !== 1) {
      return errorResponse(req, 403, 'forbidden', 'Only admin can create users')
    }
  }

  const { name, email, password } = await req.json()
  if (!email || !password) {
    return errorResponse(req, 400, 'missing_fields', 'Email and password required')
  }

  const service = createServiceClient()
  const { error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name ?? '' },
  })

  if (error) {
    return errorResponse(req, 400, 'signup_failed', error.message)
  }

  return jsonResponse({ result: true }, req)
}

async function emailLost(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return errorResponse(req, 405, 'method_not_allowed')
  }

  const { email } = await req.json()
  if (!email) {
    return errorResponse(req, 400, 'missing_fields', 'Email required')
  }

  const supabase = createAnonClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${Deno.env.get('SITE_URL') ?? 'http://localhost:3000'}/account/recover`,
  })

  if (error) {
    return errorResponse(req, 400, 'reset_failed', error.message)
  }

  return jsonResponse({ result: true }, req)
}

async function emailRecover(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return errorResponse(req, 405, 'method_not_allowed')
  }

  const { token, password } = await req.json()
  if (!token || !password) {
    return errorResponse(req, 400, 'missing_fields', 'Token and password required')
  }

  const supabase = createAnonClient()

  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: token,
    type: 'recovery',
  })

  if (verifyError || !verifyData.user) {
    return errorResponse(req, 400, 'invalid_token', 'Recovery token is invalid or expired')
  }

  const service = createServiceClient()
  const { error: updateError } = await service.auth.admin.updateUserById(
    verifyData.user.id,
    { password }
  )

  if (updateError) {
    return errorResponse(req, 400, 'update_failed', updateError.message)
  }

  return jsonResponse({ result: true, email: verifyData.user.email }, req)
}

async function logout(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return errorResponse(req, 405, 'method_not_allowed')
  }

  const client = createUserClient(req)
  await client.auth.signOut()

  const origin = req.headers.get('origin')
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...corsHeaders(origin),
  })

  const domain = Deno.env.get('COOKIE_DOMAIN') ?? ''
  const domainAttr = domain ? `; Domain=${domain}` : ''
  headers.append('Set-Cookie', `sb-access-token=; Path=/; HttpOnly; Max-Age=0${domainAttr}`)
  headers.append('Set-Cookie', `sb-refresh-token=; Path=/; HttpOnly; Max-Age=0${domainAttr}`)

  return new Response(JSON.stringify({ result: true }), { status: 200, headers })
}

async function jwtLogin(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return errorResponse(req, 405, 'method_not_allowed')
  }

  const { token } = await req.json()
  if (!token) {
    return errorResponse(req, 400, 'missing_fields', 'Token required')
  }

  const supabase = createAnonClient()
  const { data, error } = await supabase.auth.setSession({
    access_token: token,
    refresh_token: token,
  })

  if (error || !data.session) {
    return errorResponse(req, 401, 'unauthorized', 'Invalid JWT token')
  }

  const origin = req.headers.get('origin')
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...corsHeaders(origin),
  })

  const secure = Deno.env.get('COOKIE_SECURE') !== 'false'
  headers.append(
    'Set-Cookie',
    `sb-access-token=${data.session.access_token}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=${data.session.expires_in}`
  )

  return new Response(JSON.stringify({ result: true }), { status: 200, headers })
}

async function oauthNative(req: Request, path: string): Promise<Response> {
  if (req.method !== 'GET') {
    return errorResponse(req, 405, 'method_not_allowed')
  }

  const provider = path.replace('auth/', '').replace(/\/native.*/, '')
  const supportedProviders = ['google', 'apple']

  if (!supportedProviders.includes(provider)) {
    return errorResponse(req, 400, 'unsupported_provider', `Provider "${provider}" is not supported`)
  }

  const url = new URL(req.url)
  const nativeToken = url.pathname.split('/native')[1]?.replace(/^\//, '')

  if (!nativeToken) {
    return errorResponse(req, 400, 'missing_token', 'OAuth token required')
  }

  const supabase = createAnonClient()
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: provider as 'google' | 'apple',
    token: nativeToken,
  })

  if (error || !data.session) {
    return errorResponse(req, 401, 'oauth_failed', error?.message ?? 'OAuth login failed')
  }

  const origin = req.headers.get('origin')
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...corsHeaders(origin),
  })

  const secure = Deno.env.get('COOKIE_SECURE') !== 'false'
  headers.append(
    'Set-Cookie',
    `sb-access-token=${data.session.access_token}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=${data.session.expires_in}`
  )

  return new Response(JSON.stringify({ result: true, auth: true }), { status: 200, headers })
}
