const express = require('express');
const router = express.Router();
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
    next();
  });
};

const bonusClaimLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 3,
  message: { message: 'በጣም ብዙ ሙከራዎች። እባክዎ ትንሽ ይጠብቁ።' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/claim', authenticateToken, bonusClaimLimiter, async (req, res) => {
  try {
    const BONUS_AMOUNT = 50;
    const COOLDOWN_MS = 24 * 60 * 60 * 1000;
    const twentyFourHoursAgo = new Date(Date.now() - COOLDOWN_MS);

    const updatedUser = await User.findOneAndUpdate(
      { 
        _id: req.userId,
        $or: [
          { lastDailyBonus: { $exists: false } },
          { lastDailyBonus: null },
          { lastDailyBonus: { $lte: twentyFourHoursAgo } }
        ]
      },
      { 
        $inc: { balance: BONUS_AMOUNT },
        $set: { lastDailyBonus: new Date() }
      },
      { new: true }
    );

    if (!updatedUser) {
      const user = await User.findById(req.userId).select('lastDailyBonus balance');
      if (!user) {
        return res.status(404).json({ message: 'ተጠቃሚ አልተገኘም' });
      }

      if (user.lastDailyBonus) {
        const hoursSinceLastBonus = (Date.now() - new Date(user.lastDailyBonus).getTime()) / (1000 * 60 * 60);
        const hoursLeft = Math.ceil(24 - hoursSinceLastBonus);
        return res.status(400).json({ 
          message: `የቀን ስጦታውን መቀበል የምትችለው ከ ${hoursLeft} ሰዓት በኋላ ነው።` 
        });
      }
      
      return res.status(400).json({ message: 'የቀን ስጦታ ማግኘት አልተሳካም።' });
    }

    res.json({
      message: `እንኳን ደስ አለህ! ${BONUS_AMOUNT} ፖይንት አግኝተሃል።`,
      newBalance: updatedUser.balance,
      bonusAmount: BONUS_AMOUNT
    });

  } catch (error) {
    console.error('Daily bonus claim error:', error);
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

router.get('/status', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('lastDailyBonus balance');
    if (!user) {
      return res.status(404).json({ message: 'ተጠቃሚ አልተገኘም' });
    }

    const now = Date.now();
    let isReady = true;
    let hoursLeft = 0;

    if (user.lastDailyBonus) {
      const hoursSinceLastBonus = (now - new Date(user.lastDailyBonus).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastBonus < 24) {
        isReady = false;
        hoursLeft = Math.ceil(24 - hoursSinceLastBonus);
      }
    }

    res.json({
      isReady,
      hoursLeft,
      currentBalance: user.balance
    });
  } catch (error) {
    console.error('Daily bonus status error:', error);
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

module.exports = router;
