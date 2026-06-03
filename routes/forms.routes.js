const express = require('express');
const router = express.Router();
const formHistoryController = require('../controllers/formHistoryController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/history', formHistoryController.getHistory);
router.get('/analytics', formHistoryController.getAnalytics);
router.post('/history', formHistoryController.saveFormHistory);
router.get('/history/:id', formHistoryController.getFormDetail);
router.delete('/history', formHistoryController.clearHistory);
router.delete('/history/:id', formHistoryController.deleteFormHistory);

module.exports = router;
