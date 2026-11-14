const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  // ግምቱን የፈጠረው ተጠቃሚ (ተጫዋች A)
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // ግምቱን የተቀበለው ተጠቃሚ (ተጫዋች B) - መጀመሪያ ላይ ባዶ ነው
  acceptor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // 🔒 SECURITY FIRST: event REQUIRED ሆኖ ተመልሷል (duplicate prediction check እንዲሰራ)
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },

  // የትኛውን ተዋጊ መረጡ (ለምሳሌ: "red" ወይም "blue")
  fighterChoice: {
    type: String,
    enum: ['red', 'blue'],
    required: true
  },

  // 🔒 SECURITY FIRST: min 50 ሆኖ ተስተካክሏል (ከ backend MIN_BET ጋር ለማስማማት)
  amount: {
    type: Number,
    required: true,
    min: [50, 'ዝቅተኛው ግምት 50 ፖይንት ነው']
  },

  // ሁኔታ (status)
  status: {
    type: String,
    enum: ['open', 'matched', 'settled', 'cancelled'],
    default: 'open'
  },

  // አሸናፊው ተጫዋች (ውጤት ሲወጣ)
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // አሸናፊው የሚያገኘው ጠቅላላ ፖይንት
  potentialWin: {
    type: Number,
    default: 0
  },

  // የመድረኩ ኮሚሽን ፐርሰንት (ለወደፊት)
  commission: {
    type: Number,
    default: 0
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// ✅ ውጤት ሲወጣ የሚሰራ ፈንክሽን (Settle Prediction Logic)
betSchema.statics.settleBet = async function(betId, winningFighter) {
  const bet = await this.findById(betId).populate('creator acceptor');
  
  if (!bet) {
    throw new Error('ግምቱ አልተገኘም');
  }

  if (bet.status !== 'matched') {
    throw new Error('ግምቱ አልተጣመረም');
  }

  // ✅ ማስተካከያ: fighterChoice የ bet ንብረት ነው
  const isCreatorWinner = bet.fighterChoice === winningFighter;
  const winner = isCreatorWinner ? bet.creator : bet.acceptor;
  const loser = isCreatorWinner ? bet.acceptor : bet.creator;

  // አሸናፊውን ፖይንት ማስገባት (2x amount minus commission)
  const winAmount = (bet.amount * 2) - (bet.amount * 2 * bet.commission / 100);
  
  const User = mongoose.model('User');
  await User.findByIdAndUpdate(winner._id, {
    $inc: { balance: winAmount }
  });

  // ግምቱን ማዘመን
  bet.status = 'settled';
  bet.winner = winner._id;
  bet.potentialWin = winAmount;
  bet.updatedAt = Date.now();
  await bet.save();

  return bet;
};

module.exports = mongoose.model('Bet', betSchema);
