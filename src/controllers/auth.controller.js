// src/controllers/auth.controller.js
const { createOtp, findValidOtp, markOtpUsed } = require('../models/otp.model');
const { findUserByPhone, createUser } = require('../models/user.model');
const { signUserToken } = require('../utils/jwt');
const { initOnboardingForUser } = require('../models/onboarding.model');

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

// POST /api/auth/request-otp
exports.requestOtp = async (req, res) => {
  try {
    let { phone } = req.body;

    if (!phone) {
      return res
        .status(400)
        .json({ success: false, message: 'رقم الهاتف مطلوب' });
    }

    phone = phone.trim();

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // بعد 5 دقائق

    await createOtp(phone, code, expiresAt);

    // TODO: إرسال SMS حقيقي لاحقاً
    return res.json({
      success: true,
      message: 'تم إرسال الكود',
      // فقط أثناء التطوير:
      debugCode: code,
    });
  } catch (err) {
    console.error('requestOtp error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

// POST /api/auth/verify-otp
exports.verifyOtp = async (req, res) => {
  try {
    let { phone, code } = req.body;

    if (!phone || !code) {
      return res
        .status(400)
        .json({ success: false, message: 'الرجاء إدخال رقم الهاتف والكود' });
    }

    phone = phone.trim();
    code = code.trim();

    const otpRow = await findValidOtp(phone, code);
    if (!otpRow) {
      return res
        .status(400)
        .json({ success: false, message: 'الكود غير صحيح أو منتهي' });
    }

    await markOtpUsed(otpRow.id);

    const user = await findUserByPhone(phone);

    if (!user) {
      // ما عنده حساب → الفرونت يفتح فورم المعلومات
      return res.json({
        success: true,
        status: 'new',
        message: 'مستخدم جديد، الرجاء إكمال البيانات',
      });
    }

    // موجود → نرجع توكن + بياناته
    const token = signUserToken(user);

    return res.json({
      success: true,
      status: 'existing',
      token,
      user: {
        id: user.id,
        phone: user.phone,
        full_name: user.full_name,
        account_type: user.account_type,
        sector: user.sector,
        company_name: user.company_name,
        email: user.email,
        city: user.city,
      },
    });
  } catch (err) {
    console.error('verifyOtp error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

// POST /api/auth/complete-profile
exports.completeProfile = async (req, res) => {
  try {
    let {
      phone,
      sector,        // 'cars' أو 'real_estate'
      account_type,  // 'individual' أو 'company'
      full_name,
      company_name,
      email,
      city,
    } = req.body;

    if (!phone || !sector || !account_type || !full_name || !city) {
      return res.status(400).json({
        success: false,
        message: 'الرجاء تعبئة الحقول الأساسية (الهاتف، الاسم، المدينة، نوع النشاط، نوع الحساب)',
      });
    }

    phone = phone.trim();

    const existingUser = await findUserByPhone(phone);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'يوجد حساب مسبق لهذا الرقم',
      });
    }

    const newUser = await createUser({
      phone,
      full_name,
      account_type,
      sector,
      company_name: account_type === 'company' ? company_name : null,
      email,
      city,
    });

    await initOnboardingForUser(newUser.id);
    
    const token = signUserToken(newUser);

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser.id,
        phone: newUser.phone,
        full_name: newUser.full_name,
        account_type: newUser.account_type,
        sector: newUser.sector,
        company_name: newUser.company_name,
        email: newUser.email,
        city: newUser.city,
      },
    });
  } catch (err) {
    console.error('completeProfile error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};
