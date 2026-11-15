const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 100 // 🔒 Security First: Prevents excessively long organization names
  },
  description: {
    type: String,
    default: 'ስፖርት ድርጅት',
    maxlength: 500 // 🔒 Security First: Limits description length
  },
  logoUrl: {
    type: String,
    default: '',
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
  // ⏱️ Removed manual createdAt. Using timestamps: true below instead.
}, { 
  timestamps: true // Automatically manages createdAt and updatedAt
});

// 🚀 HIGH TRAFFIC: Add index for ultra-fast retrieval of active organizations
organizationSchema.index({ isActive: 1, name: 1 });

module.exports = mongoose.model('Organization', organizationSchema);
