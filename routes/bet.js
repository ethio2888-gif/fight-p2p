const express = require('express');
const router = express.Router();
const Bet = require('../models/Bet');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// 🔒 SECURITY FIRST: JWT Secret MUST be loaded from Environment Variables (No fallback)
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('⚠️ CRITICAL: JWT_SECRET is not defined in Environment Variables!');
}

// Middleware: JWT Token ማረጋገጫ
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
    req.isAdmin = decoded.isAdmin || false; // 🔑 For future admin route protection
    next();
  });
};

// 1. ክፍት ግምቶችን ማየት (Get Open Predictions)
router.get('/open', async (req, res) => {
  try {
    // 🚀 HIGH TRAFFIC: Limit results to prevent loading thousands of records
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

// 2. የእኔን ግምቶች ማየት (Get My Predictions)
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
      .sort({ createdAt: -1 })
      .limit(100); // 🚀 HIGH TRAFFIC: Limit results
    
    res.json(myBets);
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 3. ግምት መፍጠር (Create Prediction) - ተጫዋች A
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { eventId, fighterChoice, amount } = req.body;

    if (!eventId || !fighterChoice || !amount) {
      return res.status(400).json({ message: 'ሁሉም መረጃዎች ያስፈልጋሉ (eventId, fighterChoice እና amount)' });
    }

    // 🔒 SECURITY FIRST: ተጠቃሚው ለዚህ ፋይት (eventId) አስቀድሞ predict አድርጎ አለመሆኑን መፈተሽ
    const existingBet = await Bet.findOne({
      creator: req.userId,
      event: eventId,
      status: { $in: ['open', 'matched'] }
    });

    if (existingBet) {
      return res.status(400).json({ 
        message: 'ለዚህ ፋይት አስቀድመው ግምት (prediction) ሰጥተዋል! አንድ ተጫዋች ለአንድ ፋይት አንድ ጊዜ ብቻ መምረጥ ይችላል።' 
      });
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
      return res.status(400).json({ message: 'ትክክለኛ ያልሆነ የተዋጊ ምርጫ (red ወይም blue ብቻ)' });
    }

    // 🔒 SECURITY FIRST & HIGH TRAFFIC: Atomic balance deduction to prevent Race Conditions (Double Spending)
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

// 4. ግምት መቀበል (Accept Prediction) - ተጫዋች B
router.post('/accept/:betId', authenticateToken, async (req, res) => {
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

    // 🔒 SECURITY FIRST: ተቀባዩ ለዚህ ፋይት አስቀድሞ predict አድርጎ አለመሆኑን መፈተሽ
    const existingBet = await Bet.findOne({
      creator: req.userId,
      event: bet.event,
      status: { $in: ['open', 'matched'] }
    });

    if (existingBet) {
      return res.status(400).json({ 
        message: 'ለዚህ ፋይት አስቀድመው ግምት (prediction) ሰጥተዋል! አንድ ተጫዋች ለአንድ ፋይት አንድ ጊዜ ብቻ መምረጥ ይችላል።' 
      });
    }

    // 🔒 SECURITY FIRST & HIGH TRAFFIC: Atomic balance deduction
    const user = await User.findOneAndUpdate(
      { _id: req.userId, balance: { $gte: bet.amount } },
      { $inc: { balance: -bet.amount } },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({ message: 'በቂ ሂሳብ የለዎትም' });
    }

    // 🔒 SECURITY FIRST: Atomic bet matching (prevents two users from accepting the same bet simultaneously)
    const updatedBet = await Bet.findOneAndUpdate(
      { _id: req.params.betId, status: 'open', creator: { $ne: req.userId } },
      { status: 'matched', acceptor: req.userId, updatedAt: Date.now() },
      { new: true }
    );

    if (!updatedBet) {
      // Revert balance deduction since the bet could not be matched (Race condition protection)
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

// 5. ግምትን ማስተካከል/ማሸነፍ (Settle Prediction)
router.post('/settle/:betId', authenticateToken, async (req, res) => {
  try {
    const { winningFighter } = req.body;
    const { betId } = req.params;

    if (!winningFighter || !['red', 'blue'].includes(winningFighter)) {
      return res.status(400).json({ message: 'ትክክለኛ ያልሆነ አሸናፊ ምርጫ (red ወይም blue ብቻ)' });
    }

    const bet = await Bet.findById(betId);
    if (!bet) {
      return res.status(404).json({ message: 'ግምቱ አልተገኘም' });
    }

    if (bet.status !== 'matched') {
      return res.status(400).json({ message: 'ይህ ግምት ሊጣመር (matched) አልቻለም ወይም ቀድሞ ተፈትቷል' });
    }

    // Note: In a real app, this route should be protected by an isAdmin middleware.
    const settledBet = await Bet.settleBet(betId, winningFighter);
    const winner = await User.findById(settledBet.winner);

    res.json({
      message: `ግምቱ በተሳካ ሁኔታ ተፈትቷል! አሸናፊው ፖይንቱን አግኝቷል።`,
      bet: settledBet,
      winnerNewBalance: winner.balance
    });
  } catch (error) {
    console.error('Settle prediction error:', error);
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 6. ግምት መሰረዝ (Cancel Open Prediction) - ተጫዋች A
router.post('/cancel/:betId', authenticateToken, async (req, res) => {
  try {
    // 🔒 SECURITY FIRST & HIGH TRAFFIC: Atomic cancellation (ensures it's still 'open' and belongs to user)
    const updatedBet = await Bet.findOneAndUpdate(
      { _id: req.params.betId, creator: req.userId, status: 'open' },
      { status: 'cancelled', updatedAt: Date.now() },
      { new: true }
    );

    if (!updatedBet) {
      return res.status(400).json({ message: 'ይህንን ግምት የመሰረዝ መብት የለዎትም ወይም ቀድሞ ተጣምሯል/ተሰርዟል' });
    }

    // 🔒 SECURITY FIRST: Atomic refund
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
