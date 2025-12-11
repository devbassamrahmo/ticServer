const express = require('express');
const router = express.Router();
const packagesController = require('../controllers/packages.controller');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);

router.get('/', packagesController.getPackages);
router.post('/subscribe', packagesController.subscribePackage);

module.exports = router;
