// src/controllers/admin.report.controller.js
const {
  listReportsForAdmin,
  getReportByIdForAdmin,
  updateReportStatus,
  closeReport,
} = require('../models/report.model');

// عدّل حسب نظامك (مين بيحط الأدمن على req)
function getAdminId(req) {
  return req.user?.id || req.admin?.id || null;
}

const ALLOWED_STATUSES = new Set(['open', 'reviewing', 'closed']); // عدّلها لو عندك غيرها

exports.getReports = async (req, res) => {
  try {
    const { status, sector, reason, q, page, pageSize } = req.query;

    const data = await listReportsForAdmin({
      status: status || undefined,
      sector: sector || undefined,
      reason: reason || undefined,
      q: q || undefined,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });

    return res.json({ success: true, ...data });
  } catch (err) {
    console.error('admin.getReports error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.getReportById = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await getReportByIdForAdmin(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: 'البلاغ غير موجود' });
    }

    // (اختياري) لاحقاً: تجيب تفاصيل الإعلان حسب target_type/target_id
    // let target = null;
    // ...

    return res.json({ success: true, report });
  } catch (err) {
    console.error('admin.getReportById error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.updateReportStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status } = req.body;

    const adminId = getAdminId(req);
    if (!adminId) {
      return res.status(401).json({ success: false, message: 'غير مصرح' });
    }

    const st = String(status || '').trim();
    if (!ALLOWED_STATUSES.has(st)) {
      return res.status(400).json({ success: false, message: 'Status غير صالح' });
    }

    const updated = await updateReportStatus(reportId, st, adminId);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'البلاغ غير موجود' });
    }

    return res.json({ success: true, report: updated });
  } catch (err) {
    console.error('admin.updateReportStatus error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.closeReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const adminId = getAdminId(req);
    if (!adminId) {
      return res.status(401).json({ success: false, message: 'غير مصرح' });
    }

    const updated = await closeReport(reportId, adminId);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'البلاغ غير موجود' });
    }

    return res.json({ success: true, report: updated });
  } catch (err) {
    console.error('admin.closeReport error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};
