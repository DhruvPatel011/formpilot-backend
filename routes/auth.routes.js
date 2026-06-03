const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

// Public routes
router.post('/register', authLimiter, validate(authController.registerValidators), authController.register);
router.post('/login', authLimiter, validate(authController.loginValidators), authController.login);
router.post('/refresh', authController.refreshToken);

// Protected routes
router.use(protect);
router.get('/me', authController.getMe);
router.put('/me', authController.updateMe);
router.put('/change-password', authController.changePassword);
router.post('/logout', authController.logout);
router.delete('/account', authController.deleteAccount);

module.exports = router;
