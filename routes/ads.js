const express = require('express');
const router = express.Router();
const Ad = require('../models/Ad');
const { requireAdmin } = require('../middleware/adminMiddleware');

// 🔒 SECURITY FIRST: የ URL ማረጋገጫ ፈንክሽን (XSS/Open Redirect መከላከያ)
const isValidUrl = (string) => {
  try {
    const url = new URL(string);
    // ለደህንነት http ወይም https ብቻ ይፈቀዳል (javascript: ወይም data: ይከለከላሉ)
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

// 1. PUBLIC: ሁሉንም Active ማስታወቂያዎችን ማግኘት
router.get('/', async (req, res) => {
  try {
    // 🚀 HIGH TRAFFIC: Limit results to prevent loading thousands of records
    const ads = await Ad.find({ isActive: true })
      .select('title type mediaUrl imageUrl targetUrl isActive')
      .sort({ createdAt: -1 })
      .limit(50); 
    
    res.json(ads);
  } catch (error) {
    console.error('Ad GET Error:', error);
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 2. ADMIN ONLY: አዲስ ማስታወቂያ መጨመር
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { title, type, mediaUrl, imageUrl, targetUrl, endDate } = req.body;
    
    // ✅ Security: Input Validation & Sanitization
    const finalMediaUrl = mediaUrl || imageUrl;
    const cleanTitle = title ? String(title).trim() : '';
    
    if (!cleanTitle || !finalMediaUrl || !targetUrl) {
      return res.status(400).json({ message: 'ርዕስ፣ ሚዲያ ሊንክ እና የሚሄድበት ሊንክ ያስፈልጋሉ' });
    }

    if (cleanTitle.length > 100) {
      return res.status(400).json({ message: 'ርዕስ ከ100 ቁምፊዎች በላይ መሆን አይችልም' });
    }

    const finalType = type || 'image';
    if (finalType !== 'image' && finalType !== 'video') {
      return res.status(400).json({ message: 'ዓይነቱ image ወይም video ብቻ መሆን አለበት' });
    }

    // 🔒 SECURITY FIRST: ሊንኮቹ ትክክለኛ HTTP/HTTPS መሆናቸውን ማረጋገጥ
    if (!isValidUrl(finalMediaUrl) || !isValidUrl(targetUrl)) {
      return res.status(400).json({ message: 'ሚዲያ ሊንክ እና የሚሄድበት ሊንክ ትክክለኛ የ HTTP/HTTPS ሊንክ መሆን አለባቸው' });
    }

    // 🔒 SECURITY FIRST: የመጨረሻ ቀን ቢኖር ትክክለኛነቱን ማረጋገጥ
    if (endDate && isNaN(Date.parse(endDate))) {
      return res.status(400).json({ message: 'ትክክለኛ ያልሆነ የመጨረሻ ቀን ቅርጸት' });
    }

    const newAd = new Ad({
      title: cleanTitle,
      type: finalType,
      mediaUrl: finalMediaUrl,
      imageUrl: finalMediaUrl, // ለ backward compatibility
      targetUrl,
      endDate: endDate || null,
      isActive: true,
      addedBy: req.userId
    });

    await newAd.save();
    res.status(201).json({ message: 'ማስታወቂያ በተሳካ ሁኔታ ተጨምሯል', ad: newAd });
  } catch (error) {
    console.error('Ad POST Error:', error);
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 3. ADMIN ONLY: ማስታወቂያን ማስወገድ (Delete)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const ad = await Ad.findByIdAndDelete(req.params.id);
    if (!ad) {
      return res.status(404).json({ message: 'ማስታወቂያው አልተገኘም' });
    }
    res.json({ message: 'ማስታወቂያ በተሳካ ሁኔታ ተሰርዟል' });
  } catch (error) {
    console.error('Ad DELETE Error:', error);
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 4. ADMIN ONLY: ማስታወቂያን ማብራት/ማጥፋት
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
    ).select('title type mediaUrl imageUrl targetUrl isActive');
    
    if (!ad) {
      return res.status(404).json({ message: 'ማስታወቂያው አልተገኘም' });
    }
    
    res.json({ message: 'የማስታወቂያው ሁኔታ ተቀይሯል', ad });
  } catch (error) {
    console.error('Ad PUT Error:', error);
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

module.exports = router;
