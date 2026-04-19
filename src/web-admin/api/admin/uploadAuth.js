/**
 * Auth for endpoints usable both from the admin UI (Firebase ID token)
 * and from the local CLI upload script (RELEASE_UPLOAD_TOKEN env var).
 *
 *   Authorization: Bearer <firebase-id-token>    → validated by requireAdmin
 *   Authorization: Bearer <RELEASE_UPLOAD_TOKEN> → allowed when the token matches
 */
import { requireAdmin } from './middleware.js';

export async function requireAdminOrUploadToken(req, res, next) {
  const auth = req.headers.authorization;
  const expected = process.env.RELEASE_UPLOAD_TOKEN;

  if (expected && auth?.startsWith('Bearer ') && auth.slice(7) === expected) {
    req.uploadTokenUser = 'upload-token';
    return next();
  }

  return requireAdmin(req, res, next);
}
