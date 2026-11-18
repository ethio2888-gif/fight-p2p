const express = require('express');
const router = express.Router();
const Organization = require('../models/Organization');
const Fight = require('../models/Fight'); // ለ deletion check
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('⚠️ CRITICAL: JWT_SECRET is not defined in Environment Variables!');
}

// 🔒 Security: JWT verification middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token የለም። እባክዎ ይግቡ' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }
    req.userId = decoded.userId;
    req.isAdmin = decoded.isAdmin || false;
    next();
  });
};

// 🔒 Security: Admin-only middleware
const requireAdmin = (req, res, next) => {
  if (!req.isAdmin) {
    return res.status(403).json({ success: false, message: 'ይህንን ለማድረግ የአድሚን መብት ያስፈልጋል' });
  }
  next();
};

// 🔒 Security & 🚀 High Traffic: Rate limit for write operations (prevent spam/abuse)
const writeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // max 10 requests per minute
  message: { success: false, message: 'በጣም ብዙ ሙከራዎች። እባክዎ ትንሽ ይጠብቁ።' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ==========================================
// 📖 PUBLIC ROUTES (No Auth Required)
// ==========================================

// 1. Get all ACTIVE organizations (For User UI)
// 🚀 High Traffic: Select only needed fields, sorted, limited
router.get('/', async (req, res) => {
  try {
    const organizations = await Organization.find({ isActive: true })
      .select('name description logoUrl displayOrder')
      .sort({ displayOrder: 1, name: 1 })
      .limit(50); // Limit to prevent massive payloads

    res.json({
      success: true,
      count: organizations.length,
      data: organizations
    });
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ success: false, message: 'የሰርቨር ስህተት' });
  }
});

// ==========================================
// 🛡️ ADMIN ROUTES (Auth + Admin Required)
// ==========================================

// 2. Get ALL organizations including inactive (For Admin Dashboard)
router.get('/admin', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const organizations = await Organization.find()
      .sort({ displayOrder: 1, createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      count: organizations.length,
      data: organizations
    });
  } catch (error) {
    console.error('Get admin organizations error:', error);
    res.status(500).json({ success: false, message: 'የሰርቨር ስህተት' });
  }
});

// 3. Create new organization (Admin only)
router.post('/', authenticateToken, requireAdmin, writeLimiter, async (req, res) => {
  try {
    const { name, description, logoUrl, displayOrder } = req.body;

    // 🔒 Security: Input validation
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, message: 'የድርጅት ስም ያስፈልጋል' });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(400).json({ success: false, message: 'ስም በ2 እና በ100 ፊደል መካከል መሆን አለበት' });
    }

    // 🔒 Security: Check for duplicate name
    const existing = await Organization.findOne({ name: trimmedName });
    if (existing) {
      return res.status(400).json({ success: false, message: 'ይህ ስም ቀድሞ ተይዟል' });
    }

    const newOrg = new Organization({
      name: trimmedName,
      description: description ? description.trim().substring(0, 500) : 'ስፖርት ድርጅት',
      logoUrl: logoUrl ? logoUrl.trim() : '',
      displayOrder: Number(displayOrder) || 0,
      isActive: true
    });

    await newOrg.save();

    res.status(201).json({
      success: true,
      message: 'ድርጅት በተሳካ ሁኔታ ተጨምሯል',
      data: newOrg
    });
  } catch (error) {
    console.error('Create organization error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'ይህ ስም ቀድሞ ተይዟል' });
    }
    res.status(500).json({ success: false, message: 'የሰርቨር ስህተት' });
  }
});

// 4. Update organization (Admin only)
router.put('/:id', authenticateToken, requireAdmin, writeLimiter, async (req, res) => {
  try {
    const { name, description, logoUrl, isActive, displayOrder } = req.body;
    const updateData = {};
    
    if (name !== undefined) {
      const trimmedName = name.trim();
      if (trimmedName.length < 2 || trimmedName.length > 100) {
        return res.status(400).json({ success: false, message: 'ስም በ2 እና በ100 ፊደል መካከል መሆን አለበት' });
      }
      updateData.name = trimmedName;
    }
    if (description !== undefined) {
      updateData.description = description.trim().substring(0, 500);
    }
    if (logoUrl !== undefined) {
      updateData.logoUrl = logoUrl.trim();
    }
    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }
    if (displayOrder !== undefined) {
      updateData.displayOrder = Number(displayOrder) || 0;
    }

    const updatedOrg = await Organization.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedOrg) {
      return res.status(404).json({ success: false, message: 'ድርጅቱ አልተገኘም' });
    }

    res.json({
      success: true,
      message: 'ድርጅት በተሳካ ሁኔታ ተዘምኗል',
      data: updatedOrg
    });
  } catch (error) {
    console.error('Update organization error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'ይህ ስም ቀድሞ ተይዟል' });
    }
    res.status(500).json({ success: false, message: 'የሰርቨር ስህተት' });
  }
});

// 5. Delete organization (Admin only)
// 🔒 Security/Data Integrity: Prevent deletion if fights are linked to this org
router.delete('/:id', authenticateToken, requireAdmin, writeLimiter, async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    
    if (!org) {
      return res.status(404).json({ success: false, message: 'ድርጅቱ አልተገኘም' });
    }

    // 🚀 High Traffic / Data Integrity: Check if any fights are linked
    const fightCount = await Fight.countDocuments({ organization: req.params.id });
    
    if (fightCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `ይህ ድርጅት ከ ${fightCount} ፋይቶች ጋር ተያይዟል። መጀመሪያ ፋይቶቹን ይሰርዙ ወይም ወደ ሌላ ድርጅት ያዛውሩ።` 
      });
    }

    await org.deleteOne();

    res.json({
      success: true,
      message: 'ድርጅት በተሳካ ሁኔታ ተሰርዟል'
    });
  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({ success: false, message: 'የሰርቨር ስህተት' });
  }
});

module.exports = router;
