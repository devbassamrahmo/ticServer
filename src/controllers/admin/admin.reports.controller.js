// src/controllers/admin/admin.reports.controller.js
const db = require('../../config/db');
const { listAdReports, closeReport, deleteReportsForItem } = require('../../models/report.model');

exports.listReports = async (req, res) => {
  try {
    const data = await listAdReports(req.query, {
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    return res.json({ success: true, ...data });
  } catch (err) {
    console.error('admin listReports error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.closeReport = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await closeReport(id);
    if (!updated) return res.status(404).json({ success: false, message: 'البلاغ غير موجود' });
    return res.json({ success: true, report: updated });
  } catch (err) {
    console.error('admin closeReport error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

// حذف إعلان سيارة
exports.deleteCarAd = async (req, res) => {
  try {
    const { id } = req.params;

    // احذف البلاغات المرتبطة
    await deleteReportsForItem('car', id);

    const del = await db.query(`DELETE FROM car_listings WHERE id = $1`, [id]);
    if (del.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'السيارة غير موجودة' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('admin deleteCarAd error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

// حذف إعلان عقار/مشروع
exports.deleteListingAd = async (req, res) => {
  try {
    const { id } = req.params;

    await deleteReportsForItem('listing', id);

    const del = await db.query(`DELETE FROM listings WHERE id = $1`, [id]);
    if (del.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'الإعلان غير موجود' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('admin deleteListingAd error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};
