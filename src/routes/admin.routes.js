// src/routes/admin.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authRequired } = require('../middleware/auth');
const { adminRequired } = require('../middleware/admin');

// كل واجهات الأدمن تحتاج auth + admin
router.use(authRequired, adminRequired);

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

module.exports = router;
