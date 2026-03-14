import { handleCors } from '../_shared/cors.ts'
import { errorResponse } from '../_shared/response.ts'
import { handleAuthRoutes } from './routes/auth.ts'
import { handleUserRoutes } from './routes/user.ts'
import { handleCollectionRoutes } from './routes/collections.ts'
import { handleRaindropRoutes } from './routes/raindrops.ts'
import { handleTagRoutes } from './routes/tags.ts'
import { handleImportExportRoutes } from './routes/import-export.ts'
import { handleHighlightRoutes } from './routes/highlights.ts'
import { handleBackupRoutes } from './routes/backups.ts'
import { handleThumbnailRoutes } from './routes/thumbnail.ts'

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '')

  try {
    if (path.startsWith('auth/')) {
      return await handleAuthRoutes(req, path)
    }

    if (path.startsWith('user')) {
      return await handleUserRoutes(req, path)
    }

    if (path.startsWith('collection') || path.startsWith('collaborators/')) {
      return await handleCollectionRoutes(req, path)
    }

    if (path.startsWith('highlights')) {
      return await handleHighlightRoutes(req, path)
    }

    if (path.startsWith('import/') && !path.startsWith('import/url/parse')) {
      return await handleImportExportRoutes(req, path)
    }

    // Export muss VOR raindrop-Route geprueft werden
    if (path.match(/^raindrops\/.*\/export\./)) {
      return await handleImportExportRoutes(req, path)
    }

    if (path.startsWith('raindrop') || path.startsWith('import/url/parse')) {
      return await handleRaindropRoutes(req, path)
    }

    if (path.startsWith('tag') || path.startsWith('filter')) {
      return await handleTagRoutes(req, path)
    }

    if (path.startsWith('backup')) {
      return await handleBackupRoutes(req, path)
    }

    if (path.startsWith('thumbnail/')) {
      return await handleThumbnailRoutes(req, path)
    }

    return errorResponse(req, 404, 'not_found', `Route not found: ${path}`)
  } catch (err) {
    console.error('Unhandled error:', err)
    return errorResponse(req, 500, 'server_error', 'Internal server error')
  }
})
