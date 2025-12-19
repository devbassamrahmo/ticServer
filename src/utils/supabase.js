function buildPublicFileUrl(path) {
  if (!path) return null;

  const base = (process.env.SUPABASE_PUBLIC_URL || '').replace(/\/+$/, '');
  const bucket = (process.env.SUPABASE_BUCKET || 'documents').replace(/^\/+|\/+$/g, '');

  // نظّف path
  const cleanPath = String(path).trim().replace(/^\/+/, '');

  // مهم: encode لكل جزء لأن فيه مسافات/أحرف خاصة ممكن
  const encodedPath = cleanPath
    .split('/')
    .map(encodeURIComponent)
    .join('/');

  if (!base) return null;

  return `${base}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

module.exports = { buildPublicFileUrl };
