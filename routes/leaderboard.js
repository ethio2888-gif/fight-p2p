const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET /api/leaderboard - ከፍተኛ ፖይንት ያላቸውን 10 ተጠቃሚዎች ማምጣት
router.get('/', async (req, res) => {
  try {
    // 🚀 HIGH TRAFFIC: This query is ultra-fast because we added an index on 'balance' in models/User.js
    const topUsers = await User.find({})
      .select('username balance') // 🔒 SECURITY: Password and email are excluded
      .sort({ balance: -1 })      // Descending order (highest first)
      .limit(10);                 // Prevents loading the entire database
    
    res.json(topUsers);
  } catch (error) {
    console.error('Leaderboard GET Error:', error);
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

module.exports = router;
