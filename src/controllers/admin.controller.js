// src/controllers/admin.controller.js
const db = require('../config/db');
const {
  getDocumentsForAdmin,
  getUserDocumentsForAdmin,
  reviewDocument,
} = require('../models/document.model');
const { buildPublicFileUrl } = require('../utils/supabase');

// قائمة العملاء (أصحاب المواقع/الحسابات)
exports.getUsers = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, sector, q } = req.query;

    const offset = (page - 1) * pageSize;
    const params = [];
    const where = ['is_admin = FALSE']; // ما نعرض الأدمن نفسه
    let idx = 1;

    if (sector) {
      where.push(`sector = $${idx++}`);
      params.push(sector);
    }

    if (q) {
      where.push(`(full_name ILIKE $${idx} OR company_name ILIKE $${idx} OR phone ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }

    const whereClause = 'WHERE ' + where.join(' AND ');

    const listQuery = `
      SELECT
        id, full_name, company_name, phone, email, city, sector, created_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM users
      ${whereClause}
    `;

    const [listRes, countRes] = await Promise.all([
      db.query(listQuery, params),
      db.query(countQuery, params),
    ]);

    return res.json({
      success: true,
      items: listRes.rows,
      total: Number(countRes.rows[0].total),
      page: Number(page),
      pageSize: Number(pageSize),
    });
  } catch (err) {
    console.error('admin.getUsers error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

// كل الوثائق (مع فلترة)
exports.getDocuments = async (req, res) => {
  try {
    const { status, document_type, page = 1, pageSize = 20 } = req.query;

    const result = await getDocumentsForAdmin({
      status,
      document_type,
      page: Number(page),
      pageSize: Number(pageSize),
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('admin.getDocuments error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

// وثائق يوزر معيّن
exports.getUserDocuments = async (req, res) => {
  try {
    const { userId } = req.params;
    const docs = await getUserDocumentsForAdmin(userId);

    const items = docs.map(doc => ({
      ...doc,
      file_public_url: buildPublicFileUrl(doc.file_url),
    }));

    return res.json({
      success: true,
      items,
    });
  } catch (err) {
    console.error('admin.getUserDocuments error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

// approve / reject
exports.reviewDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const adminId = req.user.id;
    const { status, reject_reason } = req.body;

    try {
      const doc = await reviewDocument(documentId, adminId, {
        status,
        reject_reason,
      });

      if (!doc) {
        return res.status(404).json({
          success: false,
          message: 'الوثيقة غير موجودة',
        });
      }

      return res.json({
        success: true,
        document: doc,
      });
    } catch (err) {
      if (err.message === 'INVALID_STATUS') {
        return res.status(400).json({
          success: false,
          message: 'status يجب أن يكون approved أو rejected',
        });
      }
      throw err;
    }
  } catch (err) {
    console.error('admin.reviewDocument error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};
