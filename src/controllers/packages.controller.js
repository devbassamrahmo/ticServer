const { completeStep } = require('../models/onboarding.model');

// Mock Data
const PACKAGES = [
    {
        id: 'starter',
        name: 'الباقة الأساسية',
        price: 0,
        features: ['موقع إلكتروني', 'عدد غير محدود من الإعلانات', 'دعم فني عبر البريد'],
    },
    {
        id: 'pro',
        name: 'باقة المحترفين',
        price: 199,
        features: ['نطاق خاص', 'تحليلات متقدمة', 'دعم فني مميز', 'إزالة شعار المنصة'],
    },
];

exports.getPackages = (req, res) => {
    return res.json({
        success: true,
        packages: PACKAGES,
    });
};

exports.subscribePackage = async (req, res) => {
    try {
        const userId = req.user.id;
        const { packageId } = req.body;

        if (!packageId) {
            return res.status(400).json({
                success: false,
                message: 'packageId مطلوب',
            });
        }

        const pkg = PACKAGES.find((p) => p.id === packageId);
        if (!pkg) {
            return res.status(404).json({
                success: false,
                message: 'الباقة غير موجودة',
            });
        }

        // TODO: Implement actual subscription logic/payment here later.
        // For now, we just verify the step.

        // onboarding step: plan
        try {
            await completeStep(userId, 'plan');
        } catch (e) {
            console.error('completeStep(plan) error:', e.message);
        }

        return res.json({
            success: true,
            message: `تم الاشتراك في ${pkg.name} بنجاح`,
            package: pkg,
        });
    } catch (err) {
        console.error('subscribePackage error:', err);
        return res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
    }
};
