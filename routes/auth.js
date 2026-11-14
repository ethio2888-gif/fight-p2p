const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// 🔒 SECURITY FIRST: JWT Secret must be loaded from Environment Variables (Render)
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('⚠️ CRITICAL: JWT_SECRET is not defined in Environment Variables!');
}

// 1. ምዝገባ (Register) - 🔒 SECURITY FIRST: Mass Assignment Prevention
router.post('/register', async (req, res) => {
  try {
    // ✅ Security: Explicitly extract only allowed fields
    const { username, email, password } = req.body;
    
    // Basic input validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'ሁሉም መረጃዎች (ስም፣ ኢሜይል፣ የይለፍ ቃል) ያስፈልጋሉ' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ message: 'ይህ የተጠቃሚ ስም ወይም ኢሜይል ቀድሞ ተወስዷል' });
    }

    // Create new user (Password is hashed automatically by the User model pre-save hook)
    const newUser = new User({ 
      username: username.trim(), 
      email: email.trim().toLowerCase(), 
      password 
    });
    
    await newUser.save();

    res.status(201).json({ message: 'ተጠቃሚ በተሳካ ሁኔታ ተመዝግቧል', userId: newUser._id });
  } catch (error) {
    console.error('Register error:', error);
    
    // 🚀 HIGH TRAFFIC: Handle Mongoose Validation Errors gracefully (returns 400 instead of 500)
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 2. መግባት (Login) - 🔒 SECURITY FIRST: Secure Token Generation & Anti-Enumeration
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'የተጠቃሚ ስም እና የይለፍ ቃል ያስፈልጋሉ' });
    }

    // Find user
    const user = await User.findOne({ username });
    
    // ✅ Security: Generic error message to prevent username enumeration
    if (!user) {
      return res.status(400).json({ message: 'የተጠቃሚ ስም ወይም የይለፍ ቃል ስህተት ነው' });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    
    // ✅ Security: Generic error message even if password is wrong
    if (!isMatch) {
      return res.status(400).json({ message: 'የተጠቃሚ ስም ወይም የይለፍ ቃል ስህተት ነው' });
    }

    // ✅ Security: Include isAdmin in the JWT payload for Role-Based Access Control (RBAC)
    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username,
        isAdmin: user.isAdmin 
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({ 
      message: 'በተሳካ ሁኔታ ገብተዋል', 
      token, 
      username: user.username, 
      balance: user.balance,
      isAdmin: user.isAdmin 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

module.exports = router;
