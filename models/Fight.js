const mongoose = require('mongoose');

const fightSchema = new mongoose.Schema({
  // 🆕 የድርጅት መለያ (Organization Link)
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false 
  },
  fighter1: {
    name: { type: String, required: true, trim: true },
    record: { type: String, default: '0-0-0' },
    photo: { type: String, default: '🥊' }
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
    type: String, 
    default: null 
  },
  // 🆕 ፋይቱ የተጠናቀቀበትን ሰዓት የሚያስቀምጥ መስክ (ለ24 ሰዓት ኮሜንት እና Auto-hide ለማስላት)
  finishedAt: {
    type: Date,
    default: null,
    index: true // 🚀 HIGH TRAFFIC: ፈጣን ፍለጋ እና ማጣራት (Filtering) እንዲቻል
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true 
});

// 🚀 HIGH TRAFFIC: Add indexes for ultra-fast querying
fightSchema.index({ status: 1, date: 1 });
fightSchema.index({ addedBy: 1 });
fightSchema.index({ organization: 1 }); 
fightSchema.index({ finishedAt: 1 }); // 🆕 ለጊዜ ማጣራት (Time-based filtering)

module.exports = mongoose.model('Fight', fightSchema);
