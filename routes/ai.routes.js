const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');

router.use(protect);

router.post('/generate-answers', aiLimiter, aiController.generateAnswers);
router.post('/parse-resume', aiLimiter, aiController.parseResume);
router.post('/map-fields', aiController.mapFields);
router.get('/usage', aiController.getUsage);

module.exports = router;
