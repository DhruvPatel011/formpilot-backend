const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema({
  institution: String,
  degree: String,
  branch: String,
  startYear: Number,
  endYear: Number,
  grade: String,
  isCurrently: { type: Boolean, default: false },
}, { _id: false });

const experienceSchema = new mongoose.Schema({
  company: String,
  role: String,
  startDate: String,
  endDate: String,
  isCurrently: { type: Boolean, default: false },
  description: String,
}, { _id: false });

const profileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  profileName: {
    type: String,
    required: [true, 'Profile name is required'],
    trim: true,
    maxlength: [100, 'Profile name too long'],
  },
  profileType: {
    type: String,
    enum: ['student', 'professional', 'freelancer', 'business'],
    default: 'student',
  },
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },

  // Personal Info
  data: {
    fullName: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    dateOfBirth: { type: String },
    gender: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String, default: 'India' },
    pincode: { type: String },

    // Academic
    university: { type: String },
    college: { type: String },
    branch: { type: String },
    degree: { type: String },
    semester: { type: String },
    rollNumber: { type: String },
    cgpa: { type: String },

    // Professional
    currentCompany: { type: String },
    currentRole: { type: String },
    totalExperience: { type: String },

    // Online presence
    linkedin: { type: String },
    github: { type: String },
    portfolio: { type: String },
    resumeUrl: { type: String },

    // Skills
    skills: [{ type: String }],
    languages: [{ type: String }],

    // Education history
    education: [educationSchema],

    // Work experience
    experience: [experienceSchema],

    // Misc
    achievements: [{ type: String }],
    certifications: [{ type: String }],

    // Custom key-value for flexible form filling
    custom: { type: Map, of: String },
  },

  // Stats
  timesUsed: { type: Number, default: 0 },
  lastUsed: { type: Date },

}, {
  timestamps: true,
  toJSON: { virtuals: true, versionKey: false },
});

profileSchema.index({ userId: 1, isDefault: 1 });
profileSchema.index({ userId: 1, profileName: 1 });

// Ensure only one default profile per user
profileSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await this.constructor.updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

module.exports = mongoose.model('Profile', profileSchema);
