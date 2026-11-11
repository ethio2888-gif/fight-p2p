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

// 1. PUBLIC: ሁሉንም Active ማስታወቂያዎችን ማግኘት (SIMPLIFIED & COMPATIBLE)
router.get('/', async (req, res) => {
  try {
    // ለ debugging ሁሉንም ማስታወቂያዎች እናመጣለን (isActive: true ብቻ)
    // mediaUrl ወይም imageUrl ሁለቱንም እንዲመልስ እናደርጋለን
    const ads = await Ad.find({ isActive: true })
      .select('title type mediaUrl imageUrl targetUrl isActive')
      .sort({ createdAt: -1 });
    
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
    
    // ✅ Security: Input Validation (mediaUrl ወይም imageUrl አንዱ መኖር አለበት)
    const finalMediaUrl = mediaUrl || imageUrl;
    
    if (!title || !finalMediaUrl || !targetUrl) {
      return res.status(400).json({ message: 'ርዕስ፣ ሚዲያ ሊንክ እና የሚሄድበት ሊንክ ያስፈልጋሉ' });
    }

    const finalType = type || 'image';
    if (finalType !== 'image' && finalType !== 'video') {
      return res.status(400).json({ message: 'ዓይነቱ image ወይም video ብቻ መሆን አለበት' });
    }

    // 🔒 SECURITY FIRST: ሊንኮቹ ትክክለኛ HTTP/HTTPS መሆናቸውን ማረጋገጥ
    if (!isValidUrl(finalMediaUrl) || !isValidUrl(targetUrl)) {
      return res.status(400).json({ message: 'ሚዲያ ሊንክ እና የሚሄድበት ሊንክ ትክክለኛ የ HTTP/HTTPS ሊንክ መሆን አለባቸው' });
    }

    const newAd = new Ad({
      title,
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
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

module.exports = router;
