const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

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

// POST /api/daily-bonus/claim - የቀን ስጦታ መጠየቅ
router.post('/claim', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'ተጠቃሚ አልተገኘም' });
    }

    const BONUS_AMOUNT = 50;
    const COOLDOWN_HOURS = 24;
    const now = new Date();

    // 🔒 SECURITY FIRST: የጊዜ ልዩነት ማረጋገጫ (24 ሰዓት ካልሞላ አይሰጥም)
    if (user.lastDailyBonus) {
      const lastBonusDate = new Date(user.lastDailyBonus);
      const hoursSinceLastBonus = (now - lastBonusDate) / (1000 * 60 * 60); // ወደ ሰዓት መቀየር

      if (hoursSinceLastBonus < COOLDOWN_HOURS) {
        const hoursLeft = Math.ceil(COOLDOWN_HOURS - hoursSinceLastBonus);
        return res.status(400).json({ 
          message: `የቀን ስጦታውን መቀበል የምትችለው ከ ${hoursLeft} ሰዓት በኋላ ነው።` 
        });
      }
    }

    // ስጦታውን መስጠት እና የመጨረሻውን ቀን ማዘመን
    user.balance += BONUS_AMOUNT;
    user.lastDailyBonus = now;
    await user.save();

    res.json({
      message: `እንኳን ደስ አለህ! ${BONUS_AMOUNT} ፖይንት አግኝተሃል።`,
      newBalance: user.balance,
      bonusAmount: BONUS_AMOUNT
    });

  } catch (error) {
    console.error('Daily bonus error:', error);
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// GET /api/daily-bonus/status - ስጦታው ዝግጁ መሆኑን ለማረጋገጥ (Optional but good for UX)
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('lastDailyBonus balance');
    if (!user) return res.status(404).json({ message: 'ተጠቃሚ አልተገኘም' });

    const now = new Date();
    let isReady = true;
    let hoursLeft = 0;

    if (user.lastDailyBonus) {
      const hoursSinceLastBonus = (now - new Date(user.lastDailyBonus)) / (1000 * 60 * 60);
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
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

module.exports = router;
