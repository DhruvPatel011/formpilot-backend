const FormHistory = require('../models/FormHistory');
const UsageLog = require('../models/UsageLog');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * GET /api/forms/history
 */
exports.getHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, formType, status, startDate, endDate } = req.query;

    const filter = { userId: req.user._id };
    if (search) {
      filter.$or = [
        { formTitle: { $regex: search, $options: 'i' } },
        { formUrl: { $regex: search, $options: 'i' } },
        { website: { $regex: search, $options: 'i' } },
      ];
    }
    if (formType) filter.formType = formType;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [forms, total] = await Promise.all([
      FormHistory.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-fields'), // Exclude large fields array from list view
      FormHistory.countDocuments(filter),
    ]);

    return ApiResponse.success(res, {
      forms,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    logger.error('Get history error:', error);
    return ApiResponse.error(res, 'Failed to fetch form history.');
  }
};

/**
 * GET /api/forms/history/:id
 */
exports.getFormDetail = async (req, res) => {
  try {
    const form = await FormHistory.findOne({ _id: req.params.id, userId: req.user._id });
    if (!form) return ApiResponse.notFound(res, 'Form history not found.');
    return ApiResponse.success(res, { form });
  } catch (error) {
    return ApiResponse.error(res, 'Failed to fetch form detail.');
  }
};

/**
 * POST /api/forms/history
 */
exports.saveFormHistory = async (req, res) => {
  try {
    const { formUrl, formTitle, website, formType, fields, status, duration, profileId } = req.body;
    if (!formUrl) return ApiResponse.error(res, 'Form URL is required.', 400);

    const form = await FormHistory.create({
      userId: req.user._id,
      profileId,
      formUrl,
      formTitle,
      website,
      formType: formType || 'other',
      fields: fields || [],
      totalFields: fields?.length || 0,
      filledFields: fields?.filter(f => f.value)?.length || 0,
      status: status || 'completed',
      duration,
      submittedAt: status === 'submitted' ? new Date() : undefined,
    });

    // Increment usage
    const User = require('../models/User');
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'usage.formsFilledThisMonth': 1 },
    });

    await UsageLog.create({
      userId: req.user._id,
      action: 'form_fill',
      details: { formUrl, formType, fieldsCount: fields?.length },
      success: true,
    }).catch(() => {});

    return ApiResponse.created(res, { form }, 'Form history saved.');
  } catch (error) {
    logger.error('Save form history error:', error);
    return ApiResponse.error(res, 'Failed to save form history.');
  }
};

/**
 * DELETE /api/forms/history/:id
 */
exports.deleteFormHistory = async (req, res) => {
  try {
    const form = await FormHistory.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!form) return ApiResponse.notFound(res, 'Form history not found.');
    return ApiResponse.success(res, {}, 'Form history deleted.');
  } catch (error) {
    return ApiResponse.error(res, 'Failed to delete form history.');
  }
};

/**
 * DELETE /api/forms/history (bulk delete)
 */
exports.clearHistory = async (req, res) => {
  try {
    await FormHistory.deleteMany({ userId: req.user._id });
    return ApiResponse.success(res, {}, 'Form history cleared.');
  } catch (error) {
    return ApiResponse.error(res, 'Failed to clear form history.');
  }
};

/**
 * GET /api/forms/analytics
 */
exports.getAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;
    const [totalForms, successForms, byType, recentForms] = await Promise.all([
      FormHistory.countDocuments({ userId }),
      FormHistory.countDocuments({ userId, status: { $in: ['completed', 'submitted'] } }),
      FormHistory.aggregate([
        { $match: { userId } },
        { $group: { _id: '$formType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      FormHistory.find({ userId }).sort({ createdAt: -1 }).limit(5).select('formTitle formUrl status createdAt'),
    ]);

    const successRate = totalForms > 0 ? Math.round((successForms / totalForms) * 100) : 0;

    return ApiResponse.success(res, {
      totalForms,
      successForms,
      successRate,
      byType,
      recentForms,
      aiRequestsThisMonth: req.user.usage.aiRequestsThisMonth,
      formsFilledThisMonth: req.user.usage.formsFilledThisMonth,
    }, 'Analytics fetched.');
  } catch (error) {
    logger.error('Analytics error:', error);
    return ApiResponse.error(res, 'Failed to fetch analytics.');
  }
};
