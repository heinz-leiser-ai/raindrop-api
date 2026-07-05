import { createAnonClient } from '../../_shared/supabase.ts'
import { jsonResponse, errorResponse } from '../../_shared/response.ts'

export async function handleHealthRoute(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return errorResponse(req, 405, 'method_not_allowed')
  }

  const client = createAnonClient()
  const { data, error } = await client.from('keep_alive').select('id').limit(1).single()

  if (error) {
    return errorResponse(req, 503, 'unhealthy', error.message)
  }

  return jsonResponse({ result: true, ok: true, id: data.id }, req)
}
