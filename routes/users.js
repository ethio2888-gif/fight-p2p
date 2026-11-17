const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

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

// 1. የአሁኑን ተጠቃሚ ፕሮፋይል ማምጣት (Get Profile)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'ተጠቃሚ አልተገኘም' });
    }
    res.json({
      username: user.username,
      balance: user.balance,
      isVerified: user.isVerified,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 2. የተጠቃሚ ፕሮፋይል ማዘመን (Update Profile - ለምሳሌ ስም ለመቀየር)
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username || username.length < 3) {
      return res.status(400).json({ message: 'ስም ቢያንስ 3 ፊደል መሆን አለበት' });
    }

    // ስሙ ቀድሞ የተያዘ መሆኑን ማረጋገጥ
    const existingUser = await User.findOne({ username, _id: { $ne: req.userId } });
    if (existingUser) {
      return res.status(400).json({ message: 'ይህ ስም ቀድሞ ተይዟል' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { username },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'ፕሮፋይል በተሳካ ሁኔታ ተዘምኗል',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

module.exports = router;
