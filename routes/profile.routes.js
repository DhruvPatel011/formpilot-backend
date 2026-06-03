const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', profileController.getProfiles);
router.post('/', profileController.createProfile);
router.post('/import', profileController.importProfile);
router.get('/:id', profileController.getProfile);
router.put('/:id', profileController.updateProfile);
router.delete('/:id', profileController.deleteProfile);
router.post('/:id/duplicate', profileController.duplicateProfile);
router.put('/:id/set-default', profileController.setDefaultProfile);
router.get('/:id/export', profileController.exportProfile);

module.exports = router;
