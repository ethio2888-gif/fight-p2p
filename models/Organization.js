const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'የድርጅት ስም ያስፈልጋል'],
    unique: true,
    trim: true,
    minlength: [2, 'ስም ቢያንስ 2 ፊደል መሆን አለበት'],
    maxlength: [100, 'ስም ከ100 ፊደል አይበልጥም'] // 🔒 Security First
  },
  description: {
    type: String,
    default: 'ስፖርት ድርጅት',
    trim: true,
    maxlength: [500, 'መግለጫ ከ500 ፊደል አይበልጥም'] // 🔒 Security First
  },
  logoUrl: {
    type: String,
    default: '',
    trim: true,
    validate: {
      // 🔒 Security First: Allow only valid HTTP/HTTPS URLs or empty string
      validator: function(v) {
        if (!v || v === '') return true;
        return /^https?:\/\/.+\..+/.test(v);
      },
      message: 'ልክ ያልሆነ የሎጎ URL (Valid HTTP/HTTPS URL required)'
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true // 🚀 HIGH TRAFFIC: Fast filtering
  },
  displayOrder: {
    type: Number,
    default: 0,
    index: true // 🚀 HIGH TRAFFIC: Fast sorting
  }
}, { 
  timestamps: true // Automatically manages createdAt and updatedAt
});

// 🚀 HIGH TRAFFIC: Compound index for ultra-fast retrieval and sorting of active organizations
organizationSchema.index({ isActive: 1, displayOrder: 1, name: 1 });

module.exports = mongoose.model('Organization', organizationSchema);
