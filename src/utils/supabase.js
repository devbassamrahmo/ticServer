function buildPublicFileUrl(path) {
  if (!path) return null;

  return `${process.env.SUPABASE_PUBLIC_URL}/storage/v1/object/public/${process.env.SUPABASE_BUCKET}/${path}`;
}

module.exports = {
  buildPublicFileUrl,
};
