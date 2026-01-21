// src/controllers/auth.controller.js
const {
  generateOtpCode,
  createOtp,
  findValidOtp,
  markOtpUsed,
  invalidateOldOtps,
} = require('../models/otp.model');

const { findUserByPhone, createUser, findUserById } = require('../models/user.model');
const { signUserToken } = require('../utils/jwt');
const { initOnboardingForUser } = require('../models/onboarding.model');
const { sendOtpSms } = require('../services/sms.service');

const {
  createRefreshTokenRow,
  findValidRefreshTokenByHash,
  revokeRefreshToken,
  revokeAllForUser,
} = require('../models/refresh_token.model');

const { generateRefreshToken, hashRefreshToken } = require('../utils/refresh');

/** تطبيع رقم الجوال (بسيط، حسب السعودية) */
function normalizePhone(phone) {
  phone = phone.trim();

  if (phone.startsWith('+')) return phone;

  if (phone.startsWith('966')) {
    return '+' + phone;
  }

  if (phone.startsWith('0')) {
    return '+966' + phone.slice(1);
  }

  return '+966' + phone;
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.ip;
}

async function issueTokensForUser(req, user) {
  const accessToken = signUserToken(user);

  const refreshToken = generateRefreshToken();
  const refreshHash = hashRefreshToken(refreshToken);

  const refreshTtlDays = Number(process.env.REFRESH_TOKEN_DAYS || 30);
  const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);

  await createRefreshTokenRow({
    user_id: user.id,
    token_hash: refreshHash,
    expires_at: expiresAt,
    user_agent: req.headers['user-agent'],
    ip: getClientIp(req),
  });

  return { accessToken, refreshToken };
}

/**
 * POST /api/auth/request-otp
 */
exports.requestOtp = async (req, res) => {
  try {
    let { phone } = req.body;

    if (!phone) {
      return res
        .status(400)
        .json({ success: false, message: 'رقم الهاتف مطلوب' });
    }

    phone = normalizePhone(phone);

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // بعد 5 دقائق

    await invalidateOldOtps(phone);
    await createOtp(phone, code, expiresAt);

    // TODO: إرسال SMS حقيقي لاحقاً
    return res.json({
      success: true,
      message: 'تم إرسال الكود',
      debugCode: code,
    });
  } catch (err) {
    console.error('requestOtp error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

/**
 * POST /api/auth/verify-otp
 */
exports.verifyOtp = async (req, res) => {
  try {
    let { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        message: 'الرجاء إدخال رقم الهاتف والكود',
      });
    }

    phone = normalizePhone(phone);
    code = code.trim();

    const otpRow = await findValidOtp(phone, code);
    if (!otpRow) {
      return res.status(400).json({
        success: false,
        message: 'الكود غير صحيح أو منتهي',
      });
    }

    await markOtpUsed(otpRow.id);

    const user = await findUserByPhone(phone);

    if (!user) {
      return res.json({
        success: true,
        status: 'new',
        message: 'مستخدم جديد، الرجاء إكمال البيانات',
      });
    }

    const { accessToken, refreshToken } = await issueTokensForUser(req, user);

    return res.json({
      success: true,
      status: 'existing',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phone: user.phone,
        full_name: user.full_name,
        account_type: user.account_type,
        sector: user.sector,
        company_name: user.company_name,
        email: user.email,
        city: user.city,
        is_admin: user.is_admin || false,
      },
    });
  } catch (err) {
    console.error('verifyOtp error:', err);
    return res
      .status(500)
      .json({ success: false, message: 'خطأ في السيرفر' });
  }
};

/**
 * POST /api/auth/complete-profile
 */
exports.completeProfile = async (req, res) => {
  try {
    let {
      phone,
      sector, // 'cars' أو 'realestate'
      account_type, // 'individual' أو 'company'
      full_name,
      company_name,
      email,
      city,
    } = req.body;

    if (!phone || !sector || !account_type || !full_name || !city) {
      return res.status(400).json({
        success: false,
        message:
          'الرجاء تعبئة الحقول الأساسية (الهاتف، الاسم، المدينة، نوع النشاط، نوع الحساب)',
      });
    }

    phone = normalizePhone(phone);

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

    const { accessToken, refreshToken } = await issueTokensForUser(req, newUser);

    return res.status(201).json({
      success: true,
      accessToken,
      refreshToken,
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
    return res
      .status(500)
      .json({ success: false, message: 'خطأ في السيرفر' });
  }
};

/**
 * POST /api/auth/refresh
 * body: { refreshToken }
 */
exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'refreshToken مطلوب',
      });
    }

    const oldHash = hashRefreshToken(refreshToken);
    const oldRow = await findValidRefreshTokenByHash(oldHash);

    if (!oldRow) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token غير صالح أو منتهي',
      });
    }

    const user = await findUserById(oldRow.user_id);
    if (!user) {
      await revokeRefreshToken(oldHash);
      return res.status(401).json({ success: false, message: 'غير مصرح' });
    }

    // Rotation
    const newRefreshToken = generateRefreshToken();
    const newHash = hashRefreshToken(newRefreshToken);

    const refreshTtlDays = Number(process.env.REFRESH_TOKEN_DAYS || 30);
    const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);

    await revokeRefreshToken(oldHash, { replaced_by_hash: newHash });

    await createRefreshTokenRow({
      user_id: user.id,
      token_hash: newHash,
      expires_at: expiresAt,
      user_agent: req.headers['user-agent'],
      ip: getClientIp(req),
    });

    const accessToken = signUserToken(user);

    return res.json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error('refresh error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

/**
 * POST /api/auth/logout
 * body: { refreshToken, allDevices? }
 */
exports.logout = async (req, res) => {
  try {
    const { refreshToken, allDevices } = req.body || {};

    if (allDevices) {
      await revokeAllForUser(req.user.id);
      return res.json({
        success: true,
        message: 'تم تسجيل الخروج من كل الأجهزة',
      });
    }

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'refreshToken مطلوب لتسجيل الخروج',
      });
    }

    const hash = hashRefreshToken(refreshToken);
    await revokeRefreshToken(hash);

    return res.json({
      success: true,
      message: 'تم تسجيل الخروج بنجاح',
    });
  } catch (err) {
    console.error('logout error:', err);
    return res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر',
    });
  }
};
