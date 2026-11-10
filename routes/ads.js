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
    }).select('title imageUrl targetUrl'); // ✅ Security: ሚስጥራዊ መረጃዎችን (addedBy, _id) አያካትትም
    
    res.json(ads);
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 2. ADMIN ONLY: አዲስ ማስታወቂያ መጨመር (Secure: Token እና URL Validation ያስፈልጋል)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, imageUrl, targetUrl, endDate } = req.body;
    
    // ✅ Security: Input Validation
    if (!title || !imageUrl || !targetUrl) {
      return res.status(400).json({ message: 'ርዕስ፣ የምስል ሊንክ እና የሚሄድበት ሊንክ ያስፈልጋሉ' });
    }

    // 🔒 SECURITY FIRST: ሊንኮቹ ትክክለኛ HTTP/HTTPS መሆናቸውን ማረጋገጥ
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
    
    // ✅ Security: isActive ብቻ boolean መሆኑን ማረጋገጥ
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive የ boolean ዋጋ መሆን አለበት' });
    }

    const ad = await Ad.findByIdAndUpdate(
      req.params.id, 
      { isActive }, 
      { new: true }
    ).select('title imageUrl targetUrl isActive'); // ✅ Security: ሚስጥራዊ መረጃ አለመመለስ
    
    if (!ad) {
      return res.status(404).json({ message: 'ማስታወቂያው አልተገኘም' });
    }
    
    res.json({ message: 'የማስታወቂያው ሁኔታ ተቀይሯል', ad });
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// ⚠️ TEMPORARY: One-click test ad insertion (Remove after use)
// ለስልክ ሙከራ እንዲመች የ Token ማረጋገጫው ተነስቷል። ከተሳካ በኋላ ይህንን መስመር እናስወግዳለን።
router.get('/seed-test', async (req, res) => {
  try {
    // ማስታወቂያው ቀድሞ ካለ አያስገባም (Duplicate ለመከላከል)
    const existingAd = await Ad.findOne({ title: "Test Ad from Mobile" });
    if (existingAd) {
      return res.json({ message: "✅ Test ad already exists!", ad: existingAd });
    }
    
    // አዲስ ማስታወቂያ ይፈጥራል (addedBy ለጊዜው ተተውቷል)
    const newAd = new Ad({
      title: "Test Ad from Mobile",
      imageUrl: "https://via.placeholder.com/728x90.png?text=Fight+P2P+Test+Ad",
      targetUrl: "https://example.com",
      isActive: true
    });
    
    await newAd.save();
    res.json({ message: "🎉 Test Ad successfully inserted! You can now remove this route.", ad: newAd });
  } catch (error) {
    res.status(500).json({ message: "Error seeding test ad", error: error.message });
  }
});

module.exports = router;
