const express = require('express');
const router = express.Router();
const User = require('../models/User');

// ⚠️ TEMPORARY: ይህ route አንድ ጊዜ ብቻ ይሰራል! ከተጠቀምክ በኋላ ይህንን ፋይል ሰርዝ!
router.get('/make-ethio-admin', async (req, res) => {
  try {
    // 🔒 Security: "ethio" ብቻ አድሚን ይሆናል
    const user = await User.findOne({ username: 'ethio' });
    
    if (!user) {
      return res.json({ message: '❌ User "ethio" not found' });
    }
    
    if (user.isAdmin) {
      return res.json({ message: '✅ User "ethio" is already an admin!' });
    }
    
    user.isAdmin = true;
    await user.save();
    
    res.json({ message: '🎉 Success! User "ethio" is now an admin! You can now delete this file.' });
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

module.exports = router;
