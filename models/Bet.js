const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  // ውርርዱን የፈጠረው ተጠቃሚ (ተጫዋች A)
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // ውርርዱን የተቀበለው ተጠቃሚ (ተጫዋች B) - መጀመሪያ ላይ ባዶ ነው
  acceptor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // የትኛው ጨዋታ/ክስተት ላይ
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: false // ✅ ማስተካከያ: ከ true ወደ false ተቀይሯል (eventId optional ስለሆነ)
  },

  // የትኛውን ተዋጊ መረጡ (ለምሳሌ: "red" ወይም "blue")
  fighterChoice: {
    type: String,
    enum: ['red', 'blue'],
    required: true
  },

  // የውርርድ መጠን (በፖይንት)
  amount: {
    type: Number,
    required: true,
    min: [10, 'ዝቅተኛው ውርርድ 10 ፖይንት ነው']
  },

  // የውርርድ ሁኔታ
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

  // አሸናፊው የሚያገኘው ጠቅላላ ፖይንት (2x amount minus commission)
  potentialWin: {
    type: Number,
    default: 0
  },

  // የመድረኩ ኮሚሽን ፐርሰንት (ለወደፊት)
  commission: {
    type: Number,
    default: 0 // 0% ለአሁን (ለወደፊት 10% ልንጨምር እንችላለን)
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

// ✅ ውጤት ሲወጣ የሚሰራ ፈንክሽን (Settle Bet Logic)
betSchema.statics.settleBet = async function(betId, winningFighter) {
  const bet = await this.findById(betId).populate('creator acceptor');
  
  if (bet.status !== 'matched') {
    throw new Error('ውርርዱ አልተጣመረም');
  }

  // ✅ ማስተካከያ: fighterChoice የ bet ንብረት ነው፣ የ creator አይደለም
  const isCreatorWinner = bet.fighterChoice === winningFighter;
  const winner = isCreatorWinner ? bet.creator : bet.acceptor;
  const loser = isCreatorWinner ? bet.acceptor : bet.creator;

  // አሸናፊውን ፖይንት ማስገባት (2x amount minus commission)
  const winAmount = (bet.amount * 2) - (bet.amount * 2 * bet.commission / 100);
  
  const User = mongoose.model('User');
  await User.findByIdAndUpdate(winner._id, {
    $inc: { balance: winAmount }
  });

  // ውርርዱን ማዘመን
  bet.status = 'settled';
  bet.winner = winner._id;
  bet.potentialWin = winAmount;
  bet.updatedAt = Date.now();
  await bet.save();

  return bet;
};

module.exports = mongoose.model('Bet', betSchema);
