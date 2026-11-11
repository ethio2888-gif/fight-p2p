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
    enum: ['image', 'video'], // ✅ አዲስ: ምስል ወይም ቪዲዮ መሆኑን ይለያል
    default: 'image',
    required: true
  },
  mediaUrl: { 
    type: String, 
    required: true, 
    trim: true // ✅ አዲስ: የምስል ወይም የቪዲዮ ሊንክ
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

module.exports = mongoose.model('Ad', adSchema);
