const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150 // 🔒 Security First: Prevents excessively long titles
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  fighters: [
    {
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50 // 🔒 Security First: Prevents long fighter names
      },
      corner: {
        type: String,
        enum: ['red', 'blue'],
        required: true
      }
    }
  ],
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['upcoming', 'live', 'finished'],
    default: 'upcoming'
  },
  winner: {
    type: String, // 'red', 'blue', or 'draw'
    default: null
  }
  // ⏱️ Removed manual createdAt. Using timestamps: true below instead.
}, { 
  timestamps: true // Automatically manages createdAt and updatedAt
});

// 🚀 HIGH TRAFFIC: Add index for ultra-fast retrieval of events by status and date
eventSchema.index({ status: 1, date: 1 });
eventSchema.index({ organization: 1 });

module.exports = mongoose.model('Event', eventSchema);
