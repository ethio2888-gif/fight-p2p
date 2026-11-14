const mongoose = require('mongoose');

const fightSchema = new mongoose.Schema({
  fighter1: {
    name: { type: String, required: true, trim: true },
    record: { type: String, default: '0-0-0' },
    photo: { type: String, default: '🥊' } // ኢሞጂ ወይም የ Cloudinary ምስል ሊንክ
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
    enum: ['upcoming', 'live', 'finished'], 
    default: 'upcoming'
  },
  winner: {
    type: String, // 'red', 'blue', ወይም 'draw'
    default: null 
  },
  // 🔥 CRITICAL FIX: Removed the 'bets' array entirely. 
  // Bets are now stored ONLY in the Bet model (linked by eventId) to prevent the 16MB MongoDB document limit crash and race conditions.
  
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true 
});

// 🚀 HIGH TRAFFIC: Add indexes for ultra-fast querying
// This ensures that fetching "upcoming" or "live" fights takes milliseconds, even with millions of records.
fightSchema.index({ status: 1, date: 1 });
fightSchema.index({ addedBy: 1 });

module.exports = mongoose.model('Fight', fightSchema);
