const Profile = require('../models/Profile');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

const MAX_PROFILES = 10;

/**
 * GET /api/profiles
 */
exports.getProfiles = async (req, res) => {
  try {
    const profiles = await Profile.find({ userId: req.user._id, isActive: true })
      .sort({ isDefault: -1, createdAt: -1 });
    return ApiResponse.success(res, { profiles });
  } catch (error) {
    logger.error('Get profiles error:', error);
    return ApiResponse.error(res, 'Failed to fetch profiles.');
  }
};

/**
 * GET /api/profiles/:id
 */
exports.getProfile = async (req, res) => {
  try {
    const profile = await Profile.findOne({ _id: req.params.id, userId: req.user._id });
    if (!profile) return ApiResponse.notFound(res, 'Profile not found.');
    return ApiResponse.success(res, { profile });
  } catch (error) {
    return ApiResponse.error(res, 'Failed to fetch profile.');
  }
};

/**
 * POST /api/profiles
 */
exports.createProfile = async (req, res) => {
  try {
    const count = await Profile.countDocuments({ userId: req.user._id, isActive: true });
    if (count >= MAX_PROFILES) {
      return ApiResponse.error(res, `Maximum ${MAX_PROFILES} profiles allowed.`, 400);
    }

    const { profileName, profileType, data, isDefault } = req.body;
    if (!profileName) return ApiResponse.error(res, 'Profile name is required.', 400);

    // If first profile or explicitly set as default
    const makeDefault = isDefault || count === 0;

    const profile = await Profile.create({
      userId: req.user._id,
      profileName,
      profileType: profileType || 'student',
      data: data || {},
      isDefault: makeDefault,
    });

    return ApiResponse.created(res, { profile }, 'Profile created successfully.');
  } catch (error) {
    logger.error('Create profile error:', error);
    return ApiResponse.error(res, 'Failed to create profile.');
  }
};

/**
 * PUT /api/profiles/:id
 */
exports.updateProfile = async (req, res) => {
  try {
    const { profileName, profileType, data, isDefault } = req.body;

    const profile = await Profile.findOne({ _id: req.params.id, userId: req.user._id });
    if (!profile) return ApiResponse.notFound(res, 'Profile not found.');

    if (profileName !== undefined) profile.profileName = profileName;
    if (profileType !== undefined) profile.profileType = profileType;
    if (data !== undefined) {
      // Deep merge data fields
      Object.keys(data).forEach(key => {
        profile.data[key] = data[key];
      });
      profile.markModified('data');
    }
    if (isDefault !== undefined) profile.isDefault = isDefault;

    await profile.save();

    return ApiResponse.success(res, { profile }, 'Profile updated successfully.');
  } catch (error) {
    logger.error('Update profile error:', error);
    return ApiResponse.error(res, 'Failed to update profile.');
  }
};

/**
 * DELETE /api/profiles/:id
 */
exports.deleteProfile = async (req, res) => {
  try {
    const profile = await Profile.findOne({ _id: req.params.id, userId: req.user._id });
    if (!profile) return ApiResponse.notFound(res, 'Profile not found.');

    if (profile.isDefault) {
      return ApiResponse.error(res, 'Cannot delete the default profile. Set another as default first.', 400);
    }

    profile.isActive = false;
    await profile.save();

    return ApiResponse.success(res, {}, 'Profile deleted successfully.');
  } catch (error) {
    return ApiResponse.error(res, 'Failed to delete profile.');
  }
};

/**
 * POST /api/profiles/:id/duplicate
 */
exports.duplicateProfile = async (req, res) => {
  try {
    const count = await Profile.countDocuments({ userId: req.user._id, isActive: true });
    if (count >= MAX_PROFILES) {
      return ApiResponse.error(res, `Maximum ${MAX_PROFILES} profiles allowed.`, 400);
    }

    const source = await Profile.findOne({ _id: req.params.id, userId: req.user._id });
    if (!source) return ApiResponse.notFound(res, 'Profile not found.');

    const copy = await Profile.create({
      userId: req.user._id,
      profileName: `${source.profileName} (Copy)`,
      profileType: source.profileType,
      data: { ...source.data.toObject?.() || source.data },
      isDefault: false,
    });

    return ApiResponse.created(res, { profile: copy }, 'Profile duplicated successfully.');
  } catch (error) {
    return ApiResponse.error(res, 'Failed to duplicate profile.');
  }
};

/**
 * PUT /api/profiles/:id/set-default
 */
exports.setDefaultProfile = async (req, res) => {
  try {
    const profile = await Profile.findOne({ _id: req.params.id, userId: req.user._id });
    if (!profile) return ApiResponse.notFound(res, 'Profile not found.');

    profile.isDefault = true;
    await profile.save(); // pre-save hook handles clearing other defaults

    return ApiResponse.success(res, { profile }, 'Default profile updated.');
  } catch (error) {
    return ApiResponse.error(res, 'Failed to set default profile.');
  }
};

/**
 * GET /api/profiles/:id/export
 */
exports.exportProfile = async (req, res) => {
  try {
    const profile = await Profile.findOne({ _id: req.params.id, userId: req.user._id });
    if (!profile) return ApiResponse.notFound(res, 'Profile not found.');

    const exportData = {
      _export_version: '1.0',
      _exported_at: new Date().toISOString(),
      _app: 'FormPilot AI',
      profileName: profile.profileName,
      profileType: profile.profileType,
      data: profile.data,
    };

    return ApiResponse.success(res, { export: exportData }, 'Profile exported.');
  } catch (error) {
    return ApiResponse.error(res, 'Failed to export profile.');
  }
};

/**
 * POST /api/profiles/import
 */
exports.importProfile = async (req, res) => {
  try {
    const { profileData } = req.body;
    if (!profileData || !profileData.profileName) {
      return ApiResponse.error(res, 'Invalid profile data.', 400);
    }

    const count = await Profile.countDocuments({ userId: req.user._id, isActive: true });
    if (count >= MAX_PROFILES) {
      return ApiResponse.error(res, `Maximum ${MAX_PROFILES} profiles allowed.`, 400);
    }

    const profile = await Profile.create({
      userId: req.user._id,
      profileName: `${profileData.profileName} (Imported)`,
      profileType: profileData.profileType || 'student',
      data: profileData.data || {},
      isDefault: false,
    });

    return ApiResponse.created(res, { profile }, 'Profile imported successfully.');
  } catch (error) {
    return ApiResponse.error(res, 'Failed to import profile.');
  }
};
