function buildPublicFileUrl(filePath, bucket = 'documents') {
  if (!filePath) return null;

  const base = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const cleanPath = String(filePath).trim().replace(/^\/+/, '');

  const encodedPath = cleanPath
    .split('/')
    .map(encodeURIComponent)
    .join('/');

  if (!base) return null;

  return `${base}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

module.exports = { buildPublicFileUrl };
