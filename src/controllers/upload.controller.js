// src/controllers/upload.controller.js
const { uploadToBucket } = require('../services/upload.service');
const { createAccountDocument } = require('../models/document.model'); // لو مستخدمها

// POST /api/upload/listing-image
// form-data:
//   file: (binary)
//   listingId (اختياري)
exports.uploadListingImage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { listingId } = req.body;

    console.log('BODY >>>', req.body);
    console.log('FILES >>>', req.files?.map(f => ({ fieldname: f.fieldname, originalname: f.originalname })));

    let files = req.files || [];

    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم إرفاق أي ملف',
      });
    }

    // حد أقصى 10
    if (files.length > 10) {
      files = files.slice(0, 10);
    }

    const prefix = `dealer_${userId}/listing_${listingId || 'general'}`;

    const results = await Promise.all(
      files.map((file) =>
        uploadToBucket('listing-images', file.buffer, file.originalname, prefix)
          .then((stored) => ({
            path: stored.path,
            url: stored.url,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          }))
      )
    );

    return res.json({
      success: true,
      items: results,
    });
  } catch (err) {
    console.error('uploadListingImage error:', err);
    console.error(err.stack);
    return res.status(500).json({
      success: false,
      message: 'فشل رفع الملفات',
    });
  }
};



// POST /api/upload/branding-image
// form-data:
//   file: (binary)
//   type: "logo" | "header"
exports.uploadBrandingImages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.body; // logo | header

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'type مطلوب (logo أو header)',
      });
    }

    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم إرفاق أي ملف',
      });
    }

    const prefix = `user_${userId}/${type}`;

    const results = await Promise.all(
      files.map((file) =>
        uploadToBucket(
          'site-branding',
          file.buffer,
          file.originalname,
          prefix
        ).then((res) => ({
          path: res.path,
          url: res.url,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        }))
      )
    );

    return res.json({
      success: true,
      items: results,
    });
  } catch (err) {
    console.error('uploadBrandingImages error:', err);
    return res.status(500).json({
      success: false,
      message: 'فشل رفع البراندنغ',
    });
  }
};


// POST /api/upload/document
// form-data:
//   file: (binary)
//   document_type: "commercial_register" | "national_address" | "tax_certificate"
exports.uploadDocuments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { document_type } = req.body;

    if (!document_type) {
      return res.status(400).json({
        success: false,
        message: 'document_type مطلوب',
      });
    }

    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم إرفاق أي ملف',
      });
    }

    const prefix = `user_${userId}/${document_type}`;

    const results = [];

    for (const file of files) {
      const uploaded = await uploadToBucket(
        'documents',
        file.buffer,
        file.originalname,
        prefix
      );

      // نخزن بس المسار الداخلي — نفس سلوك النظام القديم
      const docRecord = await createAccountDocument(userId, {
        document_type,
        file_url: uploaded.path,
      });

      results.push({
        path: uploaded.path,
        url: uploaded.url,
        document: docRecord,
      });
    }

    return res.json({
      success: true,
      items: results,
    });
  } catch (err) {
    console.error('uploadDocuments error:', err);
    return res.status(500).json({
      success: false,
      message: 'فشل رفع المستندات',
    });
  }
};

exports.getListingMedia = async (req, res) => {
  try {
    const userId = req.user.id;
    const { listingId } = req.query;

    const folder = `dealer_${userId}`;
    const allFiles = await listFromBucket('listing-images', folder);

    const prefix = `listing_${listingId || 'general'}`;

    const items = allFiles
      .filter((file) => file.name.startsWith(prefix))
      .map((file) => ({
        name: file.name,
        path: file.path,
        url: file.url,
        created_at: file.created_at,
      }));

    return res.json({
      success: true,
      items,
    });
  } catch (err) {
    console.error('getListingMedia error:', err);
    return res.status(500).json({
      success: false,
      message: 'فشل جلب ملفات الإعلان',
    });
  }
};

exports.getBrandingImages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query; // logo | header

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'type مطلوب (logo أو header)',
      });
    }

    const folder = `user_${userId}/${type}`;
    const items = await listFromBucket('site-branding', folder);

    return res.json({
      success: true,
      items,
    });
  } catch (err) {
    console.error('getBrandingImages error:', err);
    return res.status(500).json({
      success: false,
      message: 'فشل جلب صور البراندنغ',
    });
  }
};

exports.getMyDocuments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { document_type } = req.query;

    const docs = await getAccountDocumentsForUser(userId, { document_type });

    return res.json({
      success: true,
      items: docs,
    });
  } catch (err) {
    console.error('getMyDocuments error:', err);
    return res.status(500).json({
      success: false,
      message: 'فشل جلب المستندات',
    });
  }
};