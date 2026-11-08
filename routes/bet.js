const express = require('express');
const router = express.Router();
const Bet = require('../models/Bet');
const Event = require('../models/Event');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// JWT Secret (ከ environment variable ይነባል)
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_this_later';

// Middleware: JWT Token ማረጋገጫ
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Token የለም። እባክዎ ይግቡ' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.userId = user.userId;
    next();
  });
};

// 1. ክፍት ውርርዶችን ማየት (Get Open Bets)
router.get('/open', async (req, res) => {
  try {
    const openBets = await Bet.find({ status: 'open' })
      .populate('creator', 'username balance')
      .populate('event')
      .sort({ createdAt: -1 });
    
    res.json(openBets);
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 2. የእኔን ውርርዶች ማየት (Get My Bets)
router.get('/my-bets', authenticateToken, async (req, res) => {
  try {
    const myBets = await Bet.find({
      $or: [
        { creator: req.userId },
        { acceptor: req.userId }
      ]
    })
      .populate('creator', 'username')
      .populate('acceptor', 'username')
      .populate('event')
      .sort({ createdAt: -1 });
    
    res.json(myBets);
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 3. ውርርድ መፍጠር (Create Bet) - ተጫዋች A
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { eventId, fighterChoice, amount } = req.body;

    if (!fighterChoice || !amount) {
      return res.status(400).json({ message: 'ሁሉም መረጃዎች ያስፈልጋሉ (fighterChoice እና amount)' });
    }

    if (amount < 10) {
      return res.status(400).json({ message: 'ዝቅተኛው ውርርድ 10 ፖይንት ነው' });
    }

    if (!['red', 'blue'].includes(fighterChoice)) {
      return res.status(400).json({ message: 'ትክክለኛ ያልሆነ የተዋጊ ምርጫ (red ወይም blue ብቻ)' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'ተጠቃሚ አልተገኘም' });
    }

    if (user.balance < amount) {
      return res.status(400).json({ message: 'በቂ ሂሳብ የለዎትም' });
    }

    user.balance -= amount;
    await user.save();

    const newBet = new Bet({
      creator: req.userId,
      event: eventId || null,
      fighterChoice,
      amount,
      status: 'open',
      potentialWin: amount * 2
    });

    await newBet.save();

    res.status(201).json({
      message: 'ውርርድ በተሳካ ሁኔታ ተፈጥሯል',
      bet: newBet,
      newBalance: user.balance
    });
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 4. ውርርድ መቀበል (Accept Bet) - ተጫዋች B
router.post('/accept/:betId', authenticateToken, async (req, res) => {
  try {
    const bet = await Bet.findById(req.params.betId).populate('creator');
    
    if (!bet) {
      return res.status(404).json({ message: 'ውርርዱ አልተገኘም' });
    }

    if (bet.status !== 'open') {
      return res.status(400).json({ message: 'ውርርዱ አልተፈጠረም ወይም ተጣምሯል' });
    }

    if (bet.creator.toString() === req.userId) {
      return res.status(400).json({ message: 'የራስዎን ውርርድ መቀበል አይችሉም' });
    }

    const user = await User.findById(req.userId);
    if (user.balance < bet.amount) {
      return res.status(400).json({ message: 'በቂ ሂሳብ የለዎትም' });
    }

    user.balance -= bet.amount;
    await user.save();

    bet.acceptor = req.userId;
    bet.status = 'matched';
    bet.updatedAt = Date.now();
    await bet.save();

    res.json({
      message: 'ውርርዱ በተሳካ ሁኔታ ተቀብለዋል! ጨዋታው ይጀምራል',
      bet,
      newBalance: user.balance
    });
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// ✅ 5. አዲስ: ውርርድን ማስተካከል/ማሸነፍ (Settle Bet)
router.post('/settle/:betId', authenticateToken, async (req, res) => {
  try {
    const { winningFighter } = req.body;
    const { betId } = req.params;

    // 1. የአሸናፊውን ምርጫ ማረጋገጥ
    if (!winningFighter || !['red', 'blue'].includes(winningFighter)) {
      return res.status(400).json({ message: 'ትክክለኛ ያልሆነ አሸናፊ ምርጫ (red ወይም blue ብቻ)' });
    }

    // 2. ውርርዱ መኖሩን እና 'matched' መሆኑን ማረጋገጥ
    const bet = await Bet.findById(betId);
    if (!bet) {
      return res.status(404).json({ message: 'ውርርዱ አልተገኘም' });
    }

    if (bet.status !== 'matched') {
      return res.status(400).json({ message: 'ይህ ውርርድ ሊጣመር (matched) አልቻለም ወይም ቀድሞ ተፈትቷል' });
    }

    // 3. በ models/Bet.js ውስጥ ያለውን settleBet ፈንክሽን መጥራት
    const settledBet = await Bet.settleBet(betId, winningFighter);

    // 4. የአሸናፊውን አዲስ ሂሳብ ለማሳየት መፈለግ
    const winner = await User.findById(settledBet.winner);

    res.json({
      message: `ውርርዱ በተሳካ ሁኔታ ተፈትቷል! አሸናፊው ፖይንቱን አግኝቷል።`,
      bet: settledBet,
      winnerNewBalance: winner.balance
    });
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

module.exports = router;
