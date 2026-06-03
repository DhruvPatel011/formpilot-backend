const { body } = require('express-validator');
const User = require('../models/User');
const TokenService = require('../services/tokenService');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

// ─── Validators ──────────────────────────────────────────────────────────────

exports.registerValidators = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase and a number'),
];

exports.loginValidators = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if email exists
    const existing = await User.findOne({ email });
    if (existing) {
      return ApiResponse.conflict(res, 'An account with this email already exists.');
    }

    const user = await User.create({ name, email, password });
    const tokens = await TokenService.generateTokenPair(user);

    logger.info(`New user registered: ${email}`);

    return TokenService.sendTokenResponse(res, tokens, user, 201);
  } catch (error) {
    logger.error('Register error:', error);
    return ApiResponse.error(res, 'Registration failed. Please try again.');
  }
};

/**
 * POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return ApiResponse.unauthorized(res, 'Invalid email or password.');
    }

    if (user.isLocked()) {
      return ApiResponse.error(res, 'Account temporarily locked due to too many failed attempts. Try again in 2 hours.', 423);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incLoginAttempts();
      return ApiResponse.unauthorized(res, 'Invalid email or password.');
    }

    // Reset attempts on success
    if (user.loginAttempts > 0) {
      await user.updateOne({ $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } });
    }

    user.lastLogin = new Date();
    await user.save();

    const tokens = await TokenService.generateTokenPair(user);

    logger.info(`User logged in: ${email}`);
    return TokenService.sendTokenResponse(res, tokens, user);
  } catch (error) {
    logger.error('Login error:', error);
    return ApiResponse.error(res, 'Login failed. Please try again.');
  }
};

/**
 * POST /api/auth/refresh
 */
exports.refreshToken = async (req, res) => {
  try {
    // Get refresh token from httpOnly cookie or body
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      return ApiResponse.unauthorized(res, 'Refresh token required.');
    }

    const { tokens, user } = await TokenService.refreshAccessToken(refreshToken);
    logger.info(`Token refreshed for user: ${user.email}`);
    return TokenService.sendTokenResponse(res, tokens, user);
  } catch (error) {
    return ApiResponse.unauthorized(res, 'Session expired. Please log in again.');
  }
};

/**
 * POST /api/auth/logout
 */
exports.logout = async (req, res) => {
  try {
    await TokenService.revokeRefreshToken(req.user._id);

    // Clear cookie
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });

    return ApiResponse.success(res, {}, 'Logged out successfully.');
  } catch (error) {
    logger.error('Logout error:', error);
    return ApiResponse.error(res, 'Logout failed.');
  }
};

/**
 * GET /api/auth/me
 */
exports.getMe = async (req, res) => {
  return ApiResponse.success(res, { user: req.user }, 'User fetched successfully.');
};

/**
 * PUT /api/auth/me
 */
exports.updateMe = async (req, res) => {
  try {
    const allowedFields = ['name', 'settings'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    return ApiResponse.success(res, { user }, 'Profile updated successfully.');
  } catch (error) {
    logger.error('Update me error:', error);
    return ApiResponse.error(res, 'Update failed.');
  }
};

/**
 * PUT /api/auth/change-password
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return ApiResponse.error(res, 'Current and new password required.', 400);
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return ApiResponse.error(res, 'Current password is incorrect.', 400);
    }

    if (newPassword.length < 8) {
      return ApiResponse.error(res, 'New password must be at least 8 characters.', 400);
    }

    user.password = newPassword;
    await user.save();

    // Revoke all sessions
    await TokenService.revokeRefreshToken(user._id);

    return ApiResponse.success(res, {}, 'Password changed. Please log in again.');
  } catch (error) {
    logger.error('Change password error:', error);
    return ApiResponse.error(res, 'Password change failed.');
  }
};

/**
 * DELETE /api/auth/account
 */
exports.deleteAccount = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isActive: false });
    await TokenService.revokeRefreshToken(req.user._id);
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    return ApiResponse.success(res, {}, 'Account deactivated successfully.');
  } catch (error) {
    logger.error('Delete account error:', error);
    return ApiResponse.error(res, 'Account deletion failed.');
  }
};
