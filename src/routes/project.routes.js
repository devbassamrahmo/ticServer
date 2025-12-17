const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listing.controller');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);

router.get('/', listingController.listProjects);
router.post('/', listingController.createProject);
router.put('/:id', listingController.updateProject);
router.delete('/:id', listingController.deleteProject);
router.get('/:id', listingController.getMyProject);
module.exports = router;
