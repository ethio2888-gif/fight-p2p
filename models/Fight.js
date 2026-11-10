const mongoose = require('mongoose');

const fightSchema = new mongoose.Schema({
  fighter1: {
    name: { type: String, required: true, trim: true },
    record: { type: String, default: '0-0-0' },
    photo: { type: String, default: '🥊' } // ኢሞጂ ወይም የምስል ሊንክ ሊሆን ይችላል
  },
  fighter2: {
    name: { type: String, required: true, trim: true },
    record: { type: String, default: '0-0-0' },
    photo: { type: String, default: '🥊' }
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['upcoming', 'live', 'finished'], // የፋይቱ ሁኔታ
    default: 'upcoming'
  },
  winner: {
    type: String,
    default: null // ፋይቱ ሲጠናቀቅ አሸናፊው እዚህ ይጻፋል
  },
  bets: [{
    username: String,
    fighter: String,
    amount: Number,
    placedAt: { type: Date, default: Date.now }
  }],
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true // createdAt እና updatedAt በራስ-ሰር ይጨምራል
});

module.exports = mongoose.model('Fight', fightSchema);
