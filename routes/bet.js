const express = require('express');
const router = express.Router();
const Bet = require('../models/Bet');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('⚠️ CRITICAL: JWT_SECRET is not defined in Environment Variables!');
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Token የለም። እባክዎ ይግቡ' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.userId = decoded.userId;
    req.isAdmin = decoded.isAdmin || false;
    next();
  });
};

const betActionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { message: 'በጣም ብዙ ጥያቄዎች። እባክዎ ትንሽ ይጠብቁ።' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/open', async (req, res) => {
  try {
    const openBets = await Bet.find({ status: 'open' })
      .populate('creator', 'username balance')
      .populate('event')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(openBets);
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

router.get('/my-bets', authenticateToken, async (req, res) => {
  try {
    const myBets = await Bet.find({
      $or: [{ creator: req.userId }, { acceptor: req.userId }]
    })
      .populate('creator', 'username')
      .populate('acceptor', 'username')
      .populate('event')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(myBets);
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

router.post('/create', authenticateToken, betActionLimiter, async (req, res) => {
  try {
    const { eventId, fighterChoice, amount } = req.body;

    if (!eventId || !fighterChoice || !amount) {
      return res.status(400).json({ message: 'ሁሉም መረጃዎች ያስፈልጋሉ' });
    }

    const existingBet = await Bet.findOne({
      creator: req.userId,
      event: eventId,
      status: { $in: ['open', 'matched'] }
    });

    if (existingBet) {
      return res.status(400).json({ message: 'ለዚህ ፋይት አስቀድመው ግምት ሰጥተዋል!' });
    }

    const betAmount = Number(amount);
    const MIN_BET = 50;
    const MAX_BET = 10000;

    if (isNaN(betAmount) || betAmount < MIN_BET) {
      return res.status(400).json({ message: `ዝቅተኛው ግምት ${MIN_BET} ፖይንት ነው` });
    }

    if (betAmount > MAX_BET) {
      return res.status(400).json({ message: `ከፍተኛው ግምት ${MAX_BET} ፖይንት ነው` });
    }

    if (!['red', 'blue'].includes(fighterChoice)) {
      return res.status(400).json({ message: 'ትክክለኛ ያልሆነ የተዋጊ ምርጫ' });
    }

    const userCheck = await User.findById(req.userId);
    if (betAmount > 5000 && !userCheck.isVerified) {
      return res.status(403).json({ message: 'ከ5,000 ፖይንት በላይ ለመጫወት መታወቂያዎን ማረጋገጥ (KYC) አለብዎት።' });
    }

    const user = await User.findOneAndUpdate(
      { _id: req.userId, balance: { $gte: betAmount } },
      { $inc: { balance: -betAmount } },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({ message: 'በቂ ሂሳብ የለዎትም' });
    }

    const newBet = new Bet({
      creator: req.userId,
      event: eventId,
      fighterChoice,
      amount: betAmount,
      status: 'open',
      potentialWin: betAmount * 2
    });

    await newBet.save();

    res.status(201).json({
      message: 'ግምት በተሳካ ሁኔታ ተፈጥሯል',
      bet: newBet,
      newBalance: user.balance
    });
  } catch (error) {
    console.error('Create prediction error:', error);
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

router.post('/accept/:betId', authenticateToken, betActionLimiter, async (req, res) => {
  try {
    const bet = await Bet.findById(req.params.betId).populate('creator');
    
    if (!bet) {
      return res.status(404).json({ message: 'ግምቱ አልተገኘም' });
    }

    if (bet.status !== 'open') {
      return res.status(400).json({ message: 'ግምቱ አልተፈጠረም ወይም ተጣምሯል' });
    }

    if (bet.creator.toString() === req.userId) {
      return res.status(400).json({ message: 'የራስዎን ግምት መቀበል አይችሉም' });
    }

    const existingBet = await Bet.findOne({
      creator: req.userId,
      event: bet.event,
      status: { $in: ['open', 'matched'] }
    });

    if (existingBet) {
      return res.status(400).json({ message: 'ለዚህ ፋይት አስቀድመው ግምት ሰጥተዋል!' });
    }

    const userCheck = await User.findById(req.userId);
    if (bet.amount > 5000 && !userCheck.isVerified) {
      return res.status(403).json({ message: 'ከ5,000 ፖይንት በላይ ለመጫወት መታወቂያዎን ማረጋገጥ (KYC) አለብዎት።' });
    }

    const user = await User.findOneAndUpdate(
      { _id: req.userId, balance: { $gte: bet.amount } },
      { $inc: { balance: -bet.amount } },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({ message: 'በቂ ሂሳብ የለዎትም' });
    }

    const updatedBet = await Bet.findOneAndUpdate(
      { _id: req.params.betId, status: 'open', creator: { $ne: req.userId } },
      { status: 'matched', acceptor: req.userId, updatedAt: Date.now() },
      { new: true }
    );

    if (!updatedBet) {
      await User.findByIdAndUpdate(req.userId, { $inc: { balance: bet.amount } });
      return res.status(400).json({ message: 'ግምቱ አልተገኘም፣ ቀድሞ ተጣምሯል፣ ወይም የራስዎ ነው' });
    }

    res.json({
      message: 'ግምቱ በተሳካ ሁኔታ ተቀብለዋል! ጨዋታው ተጣምሯል',
      bet: updatedBet,
      newBalance: user.balance
    });
  } catch (error) {
    console.error('Accept prediction error:', error);
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

router.post('/settle/:betId', authenticateToken, async (req, res) => {
  try {
    if (!req.isAdmin) {
      return res.status(403).json({ message: 'ይህንን ለማድረግ የአድሚን መብት ያስፈልጋል' });
    }

    const { winningFighter } = req.body;
    const { betId } = req.params;

    if (!winningFighter || !['red', 'blue'].includes(winningFighter)) {
      return res.status(400).json({ message: 'ትክክለኛ ያልሆነ አሸናፊ ምርጫ' });
    }

    const bet = await Bet.findById(betId);
    if (!bet) {
      return res.status(404).json({ message: 'ግምቱ አልተገኘም' });
    }

    if (bet.status !== 'matched') {
      return res.status(400).json({ message: 'ይህ ግምት ሊጣመር አልቻለም ወይም ቀድሞ ተፈትቷል' });
    }

    const settledBet = await Bet.settleBet(betId, winningFighter);
    const winner = await User.findById(settledBet.winner);

    res.json({
      message: 'ግምቱ በተሳካ ሁኔታ ተፈትቷል!',
      bet: settledBet,
      winnerNewBalance: winner.balance
    });
  } catch (error) {
    console.error('Settle prediction error:', error);
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

router.post('/cancel/:betId', authenticateToken, async (req, res) => {
  try {
    const updatedBet = await Bet.findOneAndUpdate(
      { _id: req.params.betId, creator: req.userId, status: 'open' },
      { status: 'cancelled', updatedAt: Date.now() },
      { new: true }
    );

    if (!updatedBet) {
      return res.status(400).json({ message: 'ይህንን ግምት የመሰረዝ መብት የለዎትም ወይም ቀድሞ ተጣምሯል/ተሰርዟል' });
    }

    await User.findByIdAndUpdate(req.userId, { $inc: { balance: updatedBet.amount } });

    res.json({
      message: 'ግምቱ በተሳካ ሁኔታ ተሰርዟል። ገንዘቡ ወደ ሂሳብዎ ተመልሷል።',
      refundedAmount: updatedBet.amount
    });
  } catch (error) {
    console.error('Cancel prediction error:', error);
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

module.exports = router;
