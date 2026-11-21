const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  fightId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Fight',
    required: true,
    index: true // 🚀 HIGH TRAFFIC: Fast lookup by fight
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  text: {
    type: String,
    required: [true, 'የአስተያየት ጽሑፍ ያስፈልጋል'],
    trim: true,
    minlength: [2, 'አስተያየት ቢያንስ 2 ፊደል መሆን አለበት'],
    maxlength: [500, 'አስተያየት ከ500 ፊደል አይበልጥም'] // 🔒 SECURITY FIRST: Prevent spam/long payloads
  },
  isHidden: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// 🚀 HIGH TRAFFIC: Compound index for fast sorting and filtering
commentSchema.index({ fightId: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);
