const geminiService = require('../services/geminiService');
const Profile = require('../models/Profile');
const UsageLog = require('../models/UsageLog');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

const FREE_PLAN_LIMITS = { aiRequestsThisMonth: 50 };

/**
 * Check user AI quota
 */
const checkQuota = (user) => {
  const limit = FREE_PLAN_LIMITS.aiRequestsThisMonth;
  if (user.subscription.plan === 'free' && user.usage.aiRequestsThisMonth >= limit) {
    return { allowed: false, limit, used: user.usage.aiRequestsThisMonth };
  }
  return { allowed: true };
};

/**
 * Increment usage counter
 */
const incrementUsage = async (userId) => {
  const User = require('../models/User');
  await User.findByIdAndUpdate(userId, { $inc: { 'usage.aiRequestsThisMonth': 1 } });
};

/**
 * POST /api/ai/generate-answers
 */
exports.generateAnswers = async (req, res) => {
  const start = Date.now();
  try {
    const { fields, profileId, formContext, formType } = req.body;

    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return ApiResponse.error(res, 'Form fields are required.', 400);
    }

    // Check quota
    const quota = checkQuota(req.user);
    if (!quota.allowed) {
      return ApiResponse.error(res, `Free plan limit reached (${quota.limit} AI requests/month). Please upgrade.`, 429);
    }

    // Get profile data
    let profileData = {};
    if (profileId) {
      const profile = await Profile.findOne({ _id: profileId, userId: req.user._id });
      if (profile) profileData = profile.data;
    } else {
      // Use default profile
      const profile = await Profile.findOne({ userId: req.user._id, isDefault: true });
      if (profile) profileData = profile.data;
    }

    // Choose AI function based on form type
    let answers;
    if (formType === 'job' || formType === 'internship') {
      answers = await geminiService.generateJobApplicationAnswers(fields, profileData, formContext);
    } else if (formType === 'scholarship') {
      answers = await geminiService.generateScholarshipAnswers(fields, profileData, formContext);
    } else {
      answers = await geminiService.generateFormAnswers(fields, profileData, formContext);
    }

    await incrementUsage(req.user._id);

    await UsageLog.create({
      userId: req.user._id,
      action: 'ai_generate',
      module: 'generate-answers',
      details: { fieldsCount: fields.length, formType },
      duration: Date.now() - start,
      success: true,
    });

    return ApiResponse.success(res, { answers, fieldsProcessed: fields.length }, 'Answers generated successfully.');
  } catch (error) {
    logger.error('Generate answers error:', error);
    await UsageLog.create({
      userId: req.user._id,
      action: 'ai_generate',
      module: 'generate-answers',
      duration: Date.now() - start,
      success: false,
      error: error.message,
    }).catch(() => {});
    return ApiResponse.error(res, error.message || 'AI generation failed.');
  }
};

/**
 * POST /api/ai/parse-resume
 */
exports.parseResume = async (req, res) => {
  const start = Date.now();
  try {
    const { resumeText } = req.body;
    if (!resumeText || resumeText.trim().length < 100) {
      return ApiResponse.error(res, 'Resume text is too short.', 400);
    }

    const quota = checkQuota(req.user);
    if (!quota.allowed) {
      return ApiResponse.error(res, 'AI quota exceeded. Please upgrade.', 429);
    }

    const parsed = await geminiService.parseResume(resumeText);

    await incrementUsage(req.user._id);
    await UsageLog.create({
      userId: req.user._id,
      action: 'ai_generate',
      module: 'parse-resume',
      duration: Date.now() - start,
      success: true,
    }).catch(() => {});

    return ApiResponse.success(res, { parsed }, 'Resume parsed successfully.');
  } catch (error) {
    logger.error('Parse resume error:', error);
    return ApiResponse.error(res, 'Resume parsing failed. Please try again.');
  }
};

/**
 * POST /api/ai/map-fields
 */
exports.mapFields = async (req, res) => {
  try {
    const { fields, profileId } = req.body;
    if (!fields || !Array.isArray(fields)) {
      return ApiResponse.error(res, 'Fields array required.', 400);
    }

    let profileData = {};
    if (profileId) {
      const profile = await Profile.findOne({ _id: profileId, userId: req.user._id });
      if (profile) profileData = profile.data;
    }

    const mappings = await geminiService.mapFieldsToProfile(fields, profileData);
    return ApiResponse.success(res, { mappings }, 'Fields mapped successfully.');
  } catch (error) {
    logger.error('Map fields error:', error);
    return ApiResponse.error(res, 'Field mapping failed.');
  }
};

/**
 * GET /api/ai/usage
 */
exports.getUsage = async (req, res) => {
  const user = req.user;
  const limit = user.subscription.plan === 'free' ? FREE_PLAN_LIMITS.aiRequestsThisMonth : null;

  return ApiResponse.success(res, {
    plan: user.subscription.plan,
    used: user.usage.aiRequestsThisMonth,
    limit,
    unlimited: limit === null,
    resetDate: new Date(user.usage.lastResetDate.getFullYear(), user.usage.lastResetDate.getMonth() + 1, 1).toISOString(),
  }, 'Usage fetched.');
};
