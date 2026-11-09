const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET /api/leaderboard - ከፍተኛ ፖይንት ያላቸውን 10 ተጠቃሚዎች ማምጣት
router.get('/', async (req, res) => {
  try {
    const topUsers = await User.find({})
      .select('username balance') // ✅ Security: ፓስዎርድ እና ኢሜይል አይመለስም
      .sort({ balance: -1 }) // በብዛት (Descending) ይለያል
      .limit(10); // የመጀመሪያዎቹን 10 ብቻ
    
    res.json(topUsers);
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

module.exports = router;
