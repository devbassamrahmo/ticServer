// src/controllers/onboarding.controller.js
const {
  getOnboardingForUser,
  completeStep,
} = require('../models/onboarding.model');

exports.getMyOnboarding = async (req, res) => {
  try {
    const userId = req.user.id;
    const steps = await getOnboardingForUser(userId);

    return res.json({
      success: true,
      steps,
    });
  } catch (err) {
    console.error('getMyOnboarding error:', err);
    return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
  }
};

exports.completeOnboardingStep = async (req, res) => {
  try {
    const userId = req.user.id;
    const { stepKey } = req.params;

    if (!stepKey) {
      return res.status(400).json({
        success: false,
        message: 'stepKey مفقود',
      });
    }

    const steps = await completeStep(userId, stepKey);

    if (!steps) {
      return res.status(404).json({
        success: false,
        message: 'هذه الخطوة غير موجودة',
      });
    }

    return res.json({
      success: true,
      steps,
    });

  } catch (err) {

    // 👈 هون المهم
    if (err.message === 'STEP_NOT_CURRENT') {
      return res.status(400).json({
        success: false,
        code: 'STEP_NOT_CURRENT',
        message: 'لا يمكنك إكمال هذه الخطوة قبل إكمال الخطوة الحالية',
      });
    }

    console.error('completeOnboardingStep error:', err);
    return res.status(500).json({
      success: false,
      message: 'خطأ في السيرفر',
    });
  }
};

