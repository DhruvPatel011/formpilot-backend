const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * Protect routes - verify JWT access token
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return ApiResponse.unauthorized(res, 'Access token required. Please log in.');
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return ApiResponse.unauthorized(res, 'Session expired. Please log in again.');
      }
      if (jwtErr.name === 'JsonWebTokenError') {
        return ApiResponse.unauthorized(res, 'Invalid token. Please log in again.');
      }
      throw jwtErr;
    }

    // Fetch user (validates they still exist and are active)
    const user = await User.findById(decoded.id).select('-password -refreshToken');
    if (!user) {
      return ApiResponse.unauthorized(res, 'User no longer exists.');
    }

    if (!user.isActive) {
      return ApiResponse.unauthorized(res, 'Account has been deactivated.');
    }

    if (user.isLocked()) {
      return ApiResponse.error(res, 'Account is temporarily locked due to too many failed attempts.', 423);
    }

    // Reset monthly usage if needed
    await user.resetMonthlyUsage();

    req.user = user;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return ApiResponse.error(res, 'Authentication failed.', 500);
  }
};

/**
 * Restrict to specific roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return ApiResponse.forbidden(res, `Role '${req.user.role}' is not authorized for this action.`);
    }
    next();
  };
};

/**
 * Optional auth - attach user if token present, don't block if not
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password -refreshToken');
      if (user && user.isActive) {
        req.user = user;
      }
    }
  } catch (err) {
    // Silent fail — optional auth
  }
  next();
};

module.exports = { protect, authorize, optionalAuth };
