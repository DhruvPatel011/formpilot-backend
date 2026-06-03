const rateLimit = require('express-rate-limit');
const ApiResponse = require('../utils/apiResponse');

const createLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => ApiResponse.error(res, message, 429),
  });

// General API limiter
const apiLimiter = createLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  parseInt(process.env.RATE_LIMIT_MAX) || 100,
  'Too many requests. Please try again later.'
);

// Auth endpoints — stricter
const authLimiter = createLimiter(
  15 * 60 * 1000, // 15 min
  20,
  'Too many authentication attempts. Please try again in 15 minutes.'
);

// AI generation — expensive, very strict
const aiLimiter = createLimiter(
  60 * 1000, // 1 min
  10,
  'AI rate limit reached. Please wait a moment before generating again.'
);

module.exports = { apiLimiter, authLimiter, aiLimiter };
