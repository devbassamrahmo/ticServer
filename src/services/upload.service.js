// src/services/upload.service.js
const supabase = require('../config/supabase');
const { randomUUID } = require('crypto');
const path = require('path');

async function uploadToBucket(bucket, fileBuffer, originalName, prefix) {
  const ext = path.extname(originalName) || '';
  const fileName = `${prefix}_${randomUUID()}${ext}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, fileBuffer, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  const { data: publicData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return {
    path: data.path,
    url: publicData.publicUrl,
  };
}

/**
 * لستة الملفات داخل فولدر معيّن (folder = prefix الأساسي)
 * مثال:
 *   bucket = 'listing-images'
 *   folder = 'dealer_XXX'
 */
async function listFromBucket(bucket, folder) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder || '', {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    });

  if (error) throw error;

  const files = data || [];

  return files.map((file) => {
    const filePath = folder ? `${folder}/${file.name}` : file.name;
    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return {
      name: file.name,
      path: filePath,
      url: publicData.publicUrl,
      created_at: file.created_at,
      last_accessed_at: file.last_accessed_at,
      updated_at: file.updated_at,
      metadata: file.metadata,
    };
  });
}

module.exports = { uploadToBucket, listFromBucket };
