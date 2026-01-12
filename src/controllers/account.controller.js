// src/controllers/account.controller.js
const {
  findUserById,
  updateUserProfile,
  setVerificationFlags,
} = require('../models/user.model');
const {
  createAccountDocument,
  getAccountDocumentsForUser,
} = require('../models/document.model');
const {
  listSubUsers,
  createSubUser,
  toggleSubUser,
  deleteSubUser,
} = require('../models/subUser.model');
const { completeStep } = require('../models/onboarding.model');

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    const documents = await getAccountDocumentsForUser(userId);

    return res.json({
      success: true,
      profile: {
        id: user.id,
        full_name: user.full_name,
        company_name: user.company_name,
        city: user.city,
        email: user.email,
        phone: user.phone,
        account_type: user.account_type,
        sector: user.sector,
        cars_site_slug: user.cars_site_slug || null,
        realestate_site_slug: user.realestate_site_slug || null,
        verifications: {
          nafath: user.nafath_verified,
          real_estate_license: user.real_estate_license_verified,
          car_license: user.car_license_verified,
        },
        documents,
      },
    });
  } catch (err) {
    console.error('getProfile error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, company_name, city, email, phone } = req.body;

    const updated = await updateUserProfile(userId, {
      full_name,
      company_name,
      city,
      email,
      phone,
    });

    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'لم يتم تعديل أي حقل',
      });
    }

    // ممكن نعتبر هالخطوة ضمن onboarding: basic_info
    try {
      await completeStep(userId, 'basic_info');
    } catch (e) {
      console.error('completeStep(basic_info) error:', e.message);
    }

    return res.json({
      success: true,
      profile: {
        id: updated.id,
        full_name: updated.full_name,
        company_name: updated.company_name,
        city: updated.city,
        email: updated.email,
        phone: updated.phone,
      },
    });
  } catch (err) {
    console.error('updateProfile error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    const userId = req.user.id;
    const { document_type, file_url } = req.body;

    if (!document_type || !file_url) {
      return res.status(400).json({
        success: false,
        message: 'نوع المستند ورابط الملف مطلوبان',
      });
    }

    const doc = await createAccountDocument(userId, {
      document_type,
      file_url,
    });

    return res.status(201).json({
      success: true,
      document: doc,
    });
  } catch (err) {
    console.error('uploadDocument error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

// توثيق نفاذ (محاكاة حالياً)
exports.verifyNafath = async (req, res) => {
  try {
    const userId = req.user.id;

    const updated = await setVerificationFlags(userId, { nafath: true });

    // خطوة onboarding: nafath
    try {
      await completeStep(userId, 'nafath');
    } catch (e) {
      console.error('completeStep(nafath) error:', e.message);
    }

    return res.json({
      success: true,
      verifications: {
        nafath: updated.nafath_verified,
        real_estate_license: updated.real_estate_license_verified,
        car_license: updated.car_license_verified,
      },
    });
  } catch (err) {
    console.error('verifyNafath error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

// توثيق رخصة عقارية (محاكاة)
exports.verifyRealEstateLicense = async (req, res) => {
  try {
    const userId = req.user.id;

    const updated = await setVerificationFlags(userId, { realEstate: true });

    try {
      await completeStep(userId, 'faal_license');
    } catch (e) {
      console.error('completeStep(faal_license) error:', e.message);
    }

    return res.json({
      success: true,
      verifications: {
        nafath: updated.nafath_verified,
        real_estate_license: updated.real_estate_license_verified,
        car_license: updated.car_license_verified,
      },
    });
  } catch (err) {
    console.error('verifyRealEstateLicense error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

// ===== المستخدمون الفرعيون =====

exports.listSubUsers = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { page = 1, pageSize = 10 } = req.query;

    const data = await listSubUsers(ownerId, {
      page: Number(page),
      pageSize: Number(pageSize),
    });

    return res.json({
      success: true,
      ...data,
    });
  } catch (err) {
    console.error('listSubUsers error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.addSubUser = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { full_name, phone, email, city } = req.body;

    if (!full_name) {
      return res
        .status(400)
        .json({ success: false, message: 'الاسم الكامل مطلوب' });
    }

    const subUser = await createSubUser(ownerId, {
      full_name,
      phone,
      email,
      city,
    });

    return res.status(201).json({
      success: true,
      sub_user: subUser,
    });
  } catch (err) {
    console.error('addSubUser error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.toggleSubUser = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { id } = req.params;
    const { is_active } = req.body;

    if (is_active === undefined) {
      return res.status(400).json({
        success: false,
        message: 'is_active مطلوب',
      });
    }

    const updated = await toggleSubUser(ownerId, id, !!is_active);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم الفرعي غير موجود',
      });
    }

    return res.json({
      success: true,
      sub_user: updated,
    });
  } catch (err) {
    console.error('toggleSubUser error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.deleteSubUser = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { id } = req.params;

    const ok = await deleteSubUser(ownerId, id);

    if (!ok) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم الفرعي غير موجود',
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('deleteSubUser error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.getSubUsers = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const {
      page,
      pageSize,
      city,
      type,
      status,   // "active" | "inactive"
    } = req.query;

    const result = await subUserModel.getSubUsers(
      ownerId,
      { city, type, status },
      { page, pageSize }
    );

    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('getSubUsers error:', err);
    return res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر',
    });
  }
};


