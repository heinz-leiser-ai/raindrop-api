import { corsHeaders } from './cors.ts'

export function jsonResponse(
  data: Record<string, unknown>,
  req: Request,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(req.headers.get('origin')),
    },
  })
}

export function errorResponse(
  req: Request,
  status: number,
  error: string,
  errorMessage?: string
): Response {
  return jsonResponse(
    {
      result: false,
      error,
      errorMessage: errorMessage ?? error,
    },
    req,
    status
  )
}

export function unauthorizedResponse(req: Request): Response {
  return jsonResponse({ auth: false, result: false }, req, 401)
}
