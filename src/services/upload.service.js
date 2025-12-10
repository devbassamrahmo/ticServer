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

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(data.path);

  return {
    path: data.path,
    url: publicData.publicUrl,
  };
}

module.exports = { uploadToBucket };
