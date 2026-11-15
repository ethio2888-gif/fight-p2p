const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: 100 // 🔒 Security First: የርዕስ ርዝመትን ይገድባል
  },
  type: {
    type: String,
    enum: ['image', 'video'], 
    default: 'image',
    required: true
  },
  mediaUrl: { 
    type: String, 
    required: true, 
    trim: true 
  },
  targetUrl: { 
    type: String, 
    required: true, 
    trim: true 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  startDate: { 
    type: Date, 
    default: Date.now 
  },
  endDate: { 
    type: Date 
  },
  addedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }
}, { timestamps: true });

// 🚀 HIGH TRAFFIC: Add index for ultra-fast retrieval of active ads
// This ensures fetching active ads takes milliseconds, even with thousands of records.
adSchema.index({ isActive: 1, endDate: 1 });

module.exports = mongoose.model('Ad', adSchema);
