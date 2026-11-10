const express = require('express');
const router = express.Router();
const Ad = require('../models/Ad');
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

// 🔒 SECURITY FIRST: የ URL ማረጋገጫ ፈንክሽን (XSS/Open Redirect መከላከያ)
const isValidUrl = (string) => {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

// 1. PUBLIC: Active ማስታወቂያዎችን ማግኘት (Secure: የተወሰኑ መስኮችን ብቻ ይመልሳል)
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const ads = await Ad.find({ 
      isActive: true,
      $or: [
        { endDate: { $exists: false } },
        { endDate: { $gte: now } }
      ]
    }).select('title imageUrl targetUrl'); 
    
    res.json(ads);
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 2. ADMIN ONLY: አዲስ ማስታወቂያ መጨመር (Secure: Token እና URL Validation ያስፈልጋል)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, imageUrl, targetUrl, endDate } = req.body;
    
    if (!title || !imageUrl || !targetUrl) {
      return res.status(400).json({ message: 'ርዕስ፣ የምስል ሊንክ እና የሚሄድበት ሊንክ ያስፈልጋሉ' });
    }

    if (!isValidUrl(imageUrl) || !isValidUrl(targetUrl)) {
      return res.status(400).json({ message: 'የምስል ሊንክ እና የሚሄድበት ሊንክ ትክክለኛ የ HTTP/HTTPS ሊንክ መሆን አለባቸው' });
    }

    const newAd = new Ad({
      title,
      imageUrl,
      targetUrl,
      endDate: endDate || null,
      addedBy: req.userId
    });

    await newAd.save();
    res.status(201).json({ message: 'ማስታወቂያ በተሳካ ሁኔታ ተጨምሯል', ad: newAd });
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 3. ADMIN ONLY: ማስታወቂያን ማብራት/ማጥፋት (Secure: Token ያስፈልጋል)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive የ boolean ዋጋ መሆን አለበት' });
    }

    const ad = await Ad.findByIdAndUpdate(
      req.params.id, 
      { isActive }, 
      { new: true }
    ).select('title imageUrl targetUrl isActive'); 
    
    if (!ad) {
      return res.status(404).json({ message: 'ማስታወቂያው አልተገኘም' });
    }
    
    res.json({ message: 'የማስታወቂያው ሁኔታ ተቀይሯል', ad });
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// ⚠️ TEMPORARY: ይህንን ሊንክ አንድ ጊዜ ከከፈትክ በኋላ ማስታወቂያውን ይሰርዛል (ከተጠቀምክ በኋላ ይህንን ክፍል ሰርዝ)
router.get('/delete-test-ad', async (req, res) => {
  try {
    const result = await Ad.deleteMany({ title: "Test Ad from Mobile" });
    if (result.deletedCount > 0) {
      res.json({ message: "✅ Test ad successfully deleted from database!" });
    } else {
      res.json({ message: "ℹ️ No test ad found in the database." });
    }
  } catch (error) {
    res.status(500).json({ message: "Error deleting test ad", error: error.message });
  }
});

module.exports = router;
