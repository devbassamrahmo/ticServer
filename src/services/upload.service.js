// src/services/upload.service.js
const supabase = require('../config/supabase');
const { randomUUID } = require('crypto');
const path = require('path');

function guessContentType(originalName = '', mimetype = '') {
  // إذا multer عطانا mimetype بنستخدمه
  if (mimetype && typeof mimetype === 'string') return mimetype;

  const ext = (path.extname(originalName) || '').toLowerCase();

  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.docx')
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  return 'application/octet-stream';
}

async function uploadToBucket(bucket, fileBuffer, originalName, prefix, mimetype) {
  const ext = path.extname(originalName) || '';
  const safePrefix = String(prefix || '').replace(/\/+$/g, ''); // شيل / بالنهاية لو موجود
  const fileName = `${safePrefix}_${randomUUID()}${ext}`;

  const contentType = guessContentType(originalName, mimetype);

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, fileBuffer, {
      cacheControl: '3600',
      upsert: false,
      contentType, // ✅ هون أهم سطر
    });

  if (error) throw error;

  const { data: publicData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return {
    path: data.path,
    url: publicData.publicUrl,
    contentType,
  };
}

/**
 * list files from a folder
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
