const express = require('express');
const router = express.Router();
const Ad = require('../models/Ad');
const { requireAdmin } = require('../middleware/adminMiddleware');

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
    }).select('title type mediaUrl targetUrl'); // ✅ Security: ሚስጥራዊ መረጃዎችን (addedBy, _id) አያካትትም
    
    res.json(ads);
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 2. ADMIN ONLY: አዲስ ማስታወቂያ መጨመር (Secure: requireAdmin እና URL Validation)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { title, type, mediaUrl, targetUrl, endDate } = req.body;
    
    // ✅ Security: Input Validation
    if (!title || !type || !mediaUrl || !targetUrl) {
      return res.status(400).json({ message: 'ርዕስ፣ ዓይነት፣ ሚዲያ ሊንክ እና የሚሄድበት ሊንክ ያስፈልጋሉ' });
    }

    if (type !== 'image' && type !== 'video') {
      return res.status(400).json({ message: 'ዓይነቱ image ወይም video ብቻ መሆን አለበት' });
    }

    // 🔒 SECURITY FIRST: ሊንኮቹ ትክክለኛ HTTP/HTTPS መሆናቸውን ማረጋገጥ
    if (!isValidUrl(mediaUrl) || !isValidUrl(targetUrl)) {
      return res.status(400).json({ message: 'ሚዲያ ሊንክ እና የሚሄድበት ሊንክ ትክክለኛ የ HTTP/HTTPS ሊንክ መሆን አለባቸው' });
    }

    const newAd = new Ad({
      title,
      type,
      mediaUrl,
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

// 3. ADMIN ONLY: ማስታወቂያን ማስወገድ (Delete) - ለዳሽቦርዱ ያስፈልጋል
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const ad = await Ad.findByIdAndDelete(req.params.id);
    if (!ad) {
      return res.status(404).json({ message: 'ማስታወቂያው አልተገኘም' });
    }
    res.json({ message: 'ማስታወቂያ በተሳካ ሁኔታ ተሰርዟል' });
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 4. ADMIN ONLY: ማስታወቂያን ማብራት/ማጥፋት (Optional, ለወደፊት አገልግሎት)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive የ boolean ዋጋ መሆን አለበት' });
    }

    const ad = await Ad.findByIdAndUpdate(
      req.params.id, 
      { isActive }, 
      { new: true }
    ).select('title type mediaUrl targetUrl isActive');
    
    if (!ad) {
      return res.status(404).json({ message: 'ማስታወቂያው አልተገኘም' });
    }
    
    res.json({ message: 'የማስታወቂያው ሁኔታ ተቀይሯል', ad });
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

module.exports = router;
