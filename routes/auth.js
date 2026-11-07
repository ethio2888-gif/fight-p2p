const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// JWT Secret (ለደህንነት ይህንን በኋላ ወደ Environment Variable እንቀይረዋለን)
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_this_later';

// 1. ምዝገባ (Register)
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // ተጠቃሚው ቀድሞ መመዝገቡን ማረጋገጥ
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'ይህ የተጠቃሚ ስም ቀድሞ ተወስዷል' });
    }

    // አዲስ ተጠቃሚ መፍጠር (Password በ User model ውስጥ በራሱ Hash ይደረጋል)
    const newUser = new User({ username, password });
    await newUser.save();

    res.status(201).json({ message: 'ተጠቃሚ በተሳካ ሁኔታ ተመዝግቧል', userId: newUser._id });
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 2. መግባት (Login)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // ተጠቃሚውን መፈለግ
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'የተጠቃሚ ስም ወይም የይለፍ ቃል ስህተት ነው' });
    }

    // የይለፍ ቃልን ማረጋገጥ
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'የተጠቃሚ ስም ወይም የይለፍ ቃል ስህተት ነው' });
    }

    // JWT Token መፍጠር (ለ 7 ቀናት የሚሰራ)
    const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ 
      message: 'በተሳካ ሁኔታ ገብተዋል', 
      token, 
      username: user.username, 
      balance: user.balance 
    });
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

module.exports = router;
