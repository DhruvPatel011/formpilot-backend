const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const logger = require('../utils/logger');

class TokenService {
  /**
   * Generate access token (short-lived)
   */
  static generateAccessToken(userId, role = 'user') {
    return jwt.sign(
      { id: userId, role, type: 'access' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
  }

  /**
   * Generate refresh token (long-lived, stored in DB)
   */
  static generateRefreshToken(userId) {
    return jwt.sign(
      { id: userId, type: 'refresh', jti: crypto.randomUUID() },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
    );
  }

  /**
   * Generate both tokens and save refresh token to DB
   */
  static async generateTokenPair(user) {
    const accessToken = this.generateAccessToken(user._id, user.role);
    const refreshToken = this.generateRefreshToken(user._id);

    // Hash refresh token before storing
    const hashedRefresh = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    await User.findByIdAndUpdate(user._id, {
      $set: { refreshToken: hashedRefresh },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Verify and rotate refresh token
   */
  static async refreshAccessToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check hashed token in DB
      const hashedRefresh = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      const user = await User.findOne({
        _id: decoded.id,
        refreshToken: hashedRefresh,
        isActive: true,
      });

      if (!user) {
        throw new Error('Refresh token invalid or revoked');
      }

      // Rotate — issue new pair
      const tokens = await this.generateTokenPair(user);
      return { tokens, user };
    } catch (err) {
      logger.warn('Refresh token failed:', err.message);
      throw err;
    }
  }

  /**
   * Revoke refresh token (logout)
   */
  static async revokeRefreshToken(userId) {
    await User.findByIdAndUpdate(userId, {
      $unset: { refreshToken: 1 },
    });
  }

  /**
   * Send tokens as response
   */
  static sendTokenResponse(res, tokens, user, statusCode = 200) {
    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/api/auth/refresh',
    });

    return res.status(statusCode).json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        user,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = TokenService;
