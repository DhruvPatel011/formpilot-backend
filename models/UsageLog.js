const mongoose = require('mongoose');

const usageLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  action: {
    type: String,
    enum: ['form_fill', 'ai_generate', 'profile_create', 'resume_parse', 'form_save'],
    required: true,
  },
  module: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  duration: { type: Number }, // ms
  success: { type: Boolean, default: true },
  error: { type: String },
}, {
  timestamps: true,
  capped: { size: 52428800, max: 100000 }, // 50MB cap
});

usageLogSchema.index({ userId: 1, createdAt: -1 });
usageLogSchema.index({ action: 1 });

module.exports = mongoose.model('UsageLog', usageLogSchema);
