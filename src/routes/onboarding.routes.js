// src/routes/onboarding.routes.js
const express = require('express');
const router = express.Router();

const onboardingController = require('../controllers/onboarding.controller');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);

router.get('/', onboardingController.getMyOnboarding);
router.post('/:stepKey/complete', onboardingController.completeOnboardingStep);

module.exports = router;
