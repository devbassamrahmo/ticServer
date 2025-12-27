// src/routes/admin.routes.js
const express = require('express');
const router = express.Router();

const adminController = require('../controllers/admin.controller');
const adminReportsController = require('../controllers/admin/admin.reports.controller');

const { authRequired } = require('../middleware/auth');
const { adminRequired } = require('../middleware/admin');

// كل واجهات الأدمن تحتاج auth + admin
router.use(authRequired, adminRequired);

// =======================
// Users / Documents (Existing)
// =======================

// قائمة العملاء
// GET /api/admin/users?sector=cars|realestate&q=بحث&page=1&pageSize=20
router.get('/users', adminController.getUsers);

// كل الوثائق (فلتر حسب الحالة أو النوع)
// GET /api/admin/documents?status=pending|approved|rejected&document_type=commercial_register&page=1&pageSize=20
router.get('/documents', adminController.getDocuments);

// وثائق يوزر معيّن
// GET /api/admin/users/:userId/documents
router.get('/users/:userId/documents', adminController.getUserDocuments);

// مراجعة وثيقة (Approve / Reject)
// POST /api/admin/documents/:documentId/review
router.post('/documents/:documentId/review', adminController.reviewDocument);

// =======================
// Reports (New)
// =======================

// قائمة البلاغات
// GET /api/admin/reports?status=open|closed&item_type=car|listing&site_id=...&page=1&pageSize=20
router.get('/reports', adminReportsController.listReports);

// إغلاق بلاغ
// PATCH /api/admin/reports/:id/close
router.patch('/reports/:id/close', adminReportsController.closeReport);

// =======================
// Delete Ads (Admin) (New)
// =======================

// حذف إعلان سيارة
// DELETE /api/admin/cars/:id
router.delete('/cars/:id', adminReportsController.deleteCarAd);

// حذف إعلان عقار/مشروع (listing)
// DELETE /api/admin/listings/:id
router.delete('/listings/:id', adminReportsController.deleteListingAd);

module.exports = router;
