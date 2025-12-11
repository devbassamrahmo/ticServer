const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listing.controller');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);

router.get('/', listingController.listProperties);
router.post('/', listingController.createProperty);
router.put('/:id', listingController.updateProperty);
router.delete('/:id', listingController.deleteProperty);

module.exports = router;
