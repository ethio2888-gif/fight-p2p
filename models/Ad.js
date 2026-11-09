const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true 
  },
  imageUrl: { 
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

module.exports = mongoose.model('Ad', adSchema);
