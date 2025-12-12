// src/controllers/contactForm.controller.js
const {
  createContactForm,
  getContactForms,
  getContactFormById,
} = require('../models/contactForm.model');

// POST /api/contact-forms
// body: { full_name, email, phone, message, site_id }
exports.submitContactForm = async (req, res) => {
  try {
    const { full_name, email, phone, message, site_id } = req.body;

    if (!full_name || !message) {
      return res.status(400).json({
        success: false,
        message: 'الاسم الكامل والرسالة مطلوبان',
      });
    }

    const form = await createContactForm({
      site_id,
      full_name,
      email,
      phone,
      message,
    });

    return res.status(201).json({
      success: true,
      form,
    });
  } catch (err) {
    console.error('submitContactForm error:', err);
    return res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر',
    });
  }
};

// GET /api/contact-forms?site_id=...&page=1&pageSize=20
exports.listContactForms = async (req, res) => {
  try {
    const { site_id, page = 1, pageSize = 20 } = req.query;

    const result = await getContactForms({
      site_id,
      page: Number(page),
      pageSize: Number(pageSize),
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('listContactForms error:', err);
    return res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر',
    });
  }
};

// GET /api/contact-forms/:id
exports.getContactForm = async (req, res) => {
  try {
    const { id } = req.params;

    const form = await getContactFormById(id);
    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'السجل غير موجود',
      });
    }

    return res.json({
      success: true,
      form,
    });
  } catch (err) {
    console.error('getContactForm error:', err);
    return res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر',
    });
  }
};
