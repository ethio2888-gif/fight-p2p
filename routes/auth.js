const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const https = require('https'); // 🔒 SECURITY FIRST: Built-in module for reCAPTCHA verification
const rateLimit = require('express-rate-limit'); // 🚀 HIGH TRAFFIC: Prevent brute force attacks

// 🔒 SECURITY FIRST: JWT Secret must be loaded from Environment Variables (Render)
const JWT_SECRET = process.env.JWT_SECRET;
const RECAPTCHA_SECRET_KEY = '6LcijyEuAAAAAPrHQbH1FHa8pS3yYZ6EXbIb0ET4'; // Your Secret Key

if (!JWT_SECRET) {
  console.error('⚠️ CRITICAL: JWT_SECRET is not defined in Environment Variables!');
}

// 🚀 HIGH TRAFFIC: Rate Limiters
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 registration requests per window
  message: { message: 'በጣም ብዙ የምዝገባ ሙከራዎች ተደርገዋል። እባክዎ ከ15 ደቂቃ በኋላ ይሞክሩ።' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per window
  message: { message: 'በጣም ብዙ የመግቢያ ሙከራዎች ተደርገዋል። እባክዎ ከ15 ደቂቃ በኋላ ይሞክሩ።' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper function to verify reCAPTCHA with Google
const verifyRecaptcha = async (token) => {
  const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET_KEY}&response=${token}`;
  return new Promise((resolve, reject) => {
    https.get(verifyUrl, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.success);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

// 1. ምዝገባ (Register)
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, email, password, recaptchaToken } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'ሁሉም መረጃዎች (ስም፣ ኢሜይል፣ የይለፍ ቃል) ያስፈልጋሉ' });
    }

    // 🔒 SECURITY FIRST: Verify reCAPTCHA token with Google
    if (!recaptchaToken) {
      return res.status(400).json({ message: 'reCAPTCHA ማረጋገጫ ያስፈልጋል።' });
    }
    
    const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
    if (!isRecaptchaValid) {
      return res.status(400).json({ message: 'reCAPTCHA ማረጋገጫ አልተሳካም። እባክዎ እንደገና ይሞክሩ።' });
    }

    const existingUser = await User.findOne({ $or: [{ username: username.trim() }, { email: email.trim().toLowerCase() }] });
    if (existingUser) {
      return res.status(400).json({ message: 'ይህ የተጠቃሚ ስም ወይም ኢሜይል ቀድሞ ተወስዷል' });
    }

    const newUser = new User({ 
      username: username.trim(), 
      email: email.trim().toLowerCase(), 
      password 
    });
    
    await newUser.save();
    res.status(201).json({ message: 'ተጠቃሚ በተሳካ ሁኔታ ተመዝግቧል', userId: newUser._id });
  } catch (error) {
    console.error('Register error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 2. መግባት (Login)
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'የተጠቃሚ ስም እና የይለፍ ቃል ያስፈልጋሉ' });
    }

    const user = await User.findOne({ username: username.trim() });
    
    if (!user) {
      return res.status(400).json({ message: 'የተጠቃሚ ስም ወይም የይለፍ ቃል ስህተት ነው' });
    }

    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'የተጠቃሚ ስም ወይም የይለፍ ቃል ስህተት ነው' });
    }

    // 🟡 Progressive KYC: Include isVerified in token and response
    const isVerified = user.isVerified || false;

    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username,
        isAdmin: user.isAdmin,
        isVerified: isVerified 
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({ 
      message: 'በተሳካ ሁኔታ ገብተዋል', 
      token, 
      username: user.username, 
      balance: user.balance,
      isAdmin: user.isAdmin,
      isVerified: isVerified // Sent to frontend for localStorage
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

module.exports = router;
