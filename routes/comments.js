const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('⚠️ CRITICAL: JWT_SECRET is not defined in Environment Variables!');
}

// 🔒 SECURITY FIRST: JWT verification middleware
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

// 🔒 SECURITY & 🚀 HIGH TRAFFIC: Rate limit to prevent spam (max 5 comments per minute per IP)
const commentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'በጣም ብዙ አስተያየቶችን እያደረጉ ነው። እባክዎ ትንሽ ይጠብቁ።' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 📖 1. Get comments for a specific fight (Public)
// 🚀 HIGH TRAFFIC: Pagination implemented to prevent loading thousands of comments at once
router.get('/:fightId', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const comments = await Comment.find({ fightId: req.params.fightId, isHidden: false })
      .populate('userId', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments({ fightId: req.params.fightId, isHidden: false });

    res.json({
      success: true,
      comments: comments.map(c => ({
        id: c._id,
        text: c.text,
        username: c.userId ? c.userId.username : 'ተሰርዟል',
        userId: c.userId ? c.userId._id : null,
        createdAt: c.createdAt
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ success: false, message: 'የሰርቨር ስህተት' });
  }
});

// ✍️ 2. Create a new comment (Auth required + Rate limited)
router.post('/', authenticateToken, commentLimiter, async (req, res) => {
  try {
    const { fightId, text } = req.body;

    // 🔒 SECURITY FIRST: Input validation
    if (!fightId || !text) {
      return res.status(400).json({ success: false, message: 'የፋይት ID እና የአስተያየት ጽሑፍ ያስፈልጋሉ' });
    }

    const trimmedText = text.trim();
    if (trimmedText.length < 2) {
      return res.status(400).json({ success: false, message: 'አስተያየት ቢያንስ 2 ፊደል መሆን አለበት' });
    }
    if (trimmedText.length > 500) {
      return res.status(400).json({ success: false, message: 'አስተያየት ከ500 ፊደል አይበልጥም' });
    }

    const newComment = new Comment({
      fightId,
      userId: req.userId,
      text: trimmedText
    });

    await newComment.save();
    const populated = await newComment.populate('userId', 'username');

    res.status(201).json({
      success: true,
      message: 'አስተያየት በተሳካ ሁኔታ ተጨምሯል',
      comment: {
        id: populated._id,
        text: populated.text,
        username: populated.userId.username,
        userId: populated.userId._id,
        createdAt: populated.createdAt
      }
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ success: false, message: 'የሰርቨር ስህተት' });
  }
});

// 🗑️ 3. Delete a comment (Owner or Admin only)
// 🔒 SECURITY FIRST: Strict ownership check
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ success: false, message: 'አስተያየቱ አልተገኘም' });
    }

    if (comment.userId.toString() !== req.userId && !req.isAdmin) {
      return res.status(403).json({ success: false, message: 'ይህንን አስተያየት የመሰረዝ መብት የለዎትም' });
    }

    await comment.deleteOne();
    res.json({ success: true, message: 'አስተያየቱ በተሳካ ሁኔታ ተሰርዟል' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ success: false, message: 'የሰርቨር ስህተት' });
  }
});

module.exports = router;
