const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  label: { type: String },
  type: { type: String },
  value: { type: String },
  aiGenerated: { type: Boolean, default: false },
  confidence: { type: Number, min: 0, max: 1 },
}, { _id: false });

const formHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  profileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Profile',
  },
  formUrl: { type: String, required: true },
  formTitle: { type: String },
  website: { type: String },
  formType: {
    type: String,
    enum: ['job', 'scholarship', 'survey', 'application', 'registration', 'other'],
    default: 'other',
  },
  totalFields: { type: Number, default: 0 },
  filledFields: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['draft', 'completed', 'submitted', 'failed'],
    default: 'completed',
  },
  duration: { type: Number }, // seconds
  fields: [fieldSchema],
  submittedAt: { type: Date },
}, {
  timestamps: true,
  toJSON: { versionKey: false },
});

formHistorySchema.index({ userId: 1, createdAt: -1 });
formHistorySchema.index({ userId: 1, formUrl: 1 });

module.exports = mongoose.model('FormHistory', formHistorySchema);
