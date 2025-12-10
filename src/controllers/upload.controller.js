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
    const file = req.file;
    const { listingId } = req.body; // ممكن تستخدمه بترتيب المسار

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم إرفاق ملف',
      });
    }

    const prefix = `dealer_${userId}/listing_${listingId || 'general'}`;

    const result = await uploadToBucket(
      'listing-images',         // اسم البكت في Supabase
      file.buffer,
      file.originalname,
      prefix
    );

    return res.json({
      success: true,
      path: result.path,
      url: result.url,
    });
  } catch (err) {
    console.error('uploadListingImage error:', err);
    return res.status(500).json({
      success: false,
      message: 'فشل رفع الملف',
    });
  }
};


// POST /api/upload/branding-image
// form-data:
//   file: (binary)
//   type: "logo" | "header"
exports.uploadBrandingImage = async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;
    const { type } = req.body; // logo | header

    if (!file || !type) {
      return res.status(400).json({
        success: false,
        message: 'الملف و type مطلوبان',
      });
    }

    const prefix = `user_${userId}/${type}`;

    const result = await uploadToBucket(
      'site-branding',
      file.buffer,
      file.originalname,
      prefix
    );

    return res.json({
      success: true,
      path: result.path,
      url: result.url,
    });
  } catch (err) {
    console.error('uploadBrandingImage error:', err);
    return res.status(500).json({
      success: false,
      message: 'فشل رفع الملف',
    });
  }
};


// POST /api/upload/document
// form-data:
//   file: (binary)
//   document_type: "commercial_register" | "national_address" | "tax_certificate"
exports.uploadDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;
    const { document_type } = req.body;

    if (!file || !document_type) {
      return res.status(400).json({
        success: false,
        message: 'الملف و document_type مطلوبان',
      });
    }

    const prefix = `user_${userId}/${document_type}`;

    const result = await uploadToBucket(
      'documents',              // bucket الخاص بالوثائق (يفضل يكون private)
      file.buffer,
      file.originalname,
      prefix
    );

    // خيار 1: ترجع فقط مسار الملف، والفرونت ينادي /api/account/documents
    // خيار 2: تنشئ السجل هون مباشرة في account_documents:

    let documentRecord = null;
    try {
      documentRecord = await createAccountDocument(userId, {
        document_type,
        file_url: result.path, // نخزن المسار الداخلي، مو ال public URL
      });
    } catch (e) {
      console.error('createAccountDocument error:', e);
    }

    return res.json({
      success: true,
      path: result.path,
      url: result.url,          // لو البكت public بيكون usable، لو private تجاهلو بالفرونت
      document: documentRecord, // اختياري
    });
  } catch (err) {
    console.error('uploadDocument error:', err);
    return res.status(500).json({
      success: false,
      message: 'فشل رفع الملف',
    });
  }
};
