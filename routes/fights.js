const express = require('express');
const router = express.Router();
const Fight = require('../models/Fight');
const Bet = require('../models/Bet');
const User = require('../models/User'); // 🔒 Added for refund logic
const { requireAdmin } = require('../middleware/adminMiddleware');

// 🔒 SECURITY FIRST: የግቤት መረጃ ማረጋገጫ እና ማጽዳት (Input Validation & Sanitization)
const validateFightInput = (data) => {
  const errors = [];
  if (!data.fighter1 || !data.fighter1.name || !data.fighter1.name.trim()) {
    errors.push('የፋይተር 1 ስም ያስፈልጋል');
  }
  if (!data.fighter2 || !data.fighter2.name || !data.fighter2.name.trim()) {
    errors.push('የፋይተር 2 ስም ያስፈልጋል');
  }
  if (!data.date) {
    errors.push('የፋይት ቀን ያስፈልጋል');
  } else if (isNaN(Date.parse(data.date))) {
    errors.push('ትክክለኛ ያልሆነ የቀን ቅርጸት');
  }
  
  const name1 = data.fighter1?.name?.trim();
  const name2 = data.fighter2?.name?.trim();
  
  if (name1 && name1.length > 50) errors.push('የፋይተር 1 ስም በጣም ረጅም ነው (ከ50 ቁምፊ በታች)');
  if (name2 && name2.length > 50) errors.push('የፋይተር 2 ስም በጣም ረጅም ነው (ከ50 ቁምፊ በታች)');
  
  return errors;
};

// 1. PUBLIC: ሁሉንም ፋይቶች ማግኘት (ለፊት-ኤንድ ማሳያ)
router.get('/', async (req, res) => {
  try {
    // 🚀 HIGH TRAFFIC: Limit results to prevent loading thousands of records
    const fights = await Fight.find()
      .sort({ date: 1 })
      .limit(50) 
      .select('-bets'); // Exclude bets array if it exists in schema to reduce payload size
    
    res.json(fights);
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 2. ADMIN ONLY: አዲስ ፋይት መጨመር
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { fighter1, fighter2, date, status } = req.body;
    
    // Sanitize inputs (remove leading/trailing spaces)
    const cleanFighter1 = { ...fighter1, name: fighter1.name.trim() };
    const cleanFighter2 = { ...fighter2, name: fighter2.name.trim() };

    const errors = validateFightInput({ fighter1: cleanFighter1, fighter2: cleanFighter2, date });
    if (errors.length > 0) {
      return res.status(400).json({ message: errors.join(', ') });
    }

    const newFight = new Fight({
      fighter1: cleanFighter1,
      fighter2: cleanFighter2,
      date,
      status: status || 'upcoming',
      addedBy: req.userId
    });

    await newFight.save();
    res.status(201).json({ message: 'ፋይት በተሳካ ሁኔታ ተጨምሯል', fight: newFight });
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 3. ADMIN ONLY: ፋይት ማስተካከል (Update)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { fighter1, fighter2, date, status, winner } = req.body;
    const updateData = {};
    
    if (fighter1) updateData.fighter1 = { ...fighter1, name: fighter1.name.trim() };
    if (fighter2) updateData.fighter2 = { ...fighter2, name: fighter2.name.trim() };
    if (date) {
      if (isNaN(Date.parse(date))) {
        return res.status(400).json({ message: 'ትክክለኛ ያልሆነ የቀን ቅርጸት' });
      }
      updateData.date = date;
    }
    if (status) updateData.status = status;
    if (winner) updateData.winner = winner;

    const fight = await Fight.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (!fight) {
      return res.status(404).json({ message: 'ፋይት አልተገኘም' });
    }

    res.json({ message: 'ፋይት በተሳካ ሁኔታ ተስተካክሏል', fight });
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 4. ADMIN ONLY: ፋይት መሰረዝ (Delete)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    // 🔒 SECURITY FIRST: Prevent deletion if there are active bets to avoid orphaned data and financial loss
    const activeBetsCount = await Bet.countDocuments({ 
      event: req.params.id, 
      status: { $in: ['open', 'matched'] } 
    });

    if (activeBetsCount > 0) {
      return res.status(400).json({ 
        message: `ይህንን ፋይት መሰረዝ አይቻልም። ${activeBetsCount} ንቁ ግምቶች (active bets) ስላሉት፣ መጀመሪያ ውጤት መግለጽ ወይም ግምቶቹን መሰረዝ አለብዎት።` 
      });
    }

    const fight = await Fight.findByIdAndDelete(req.params.id);
    if (!fight) {
      return res.status(404).json({ message: 'ፋይት አልተገኘም' });
    }
    res.json({ message: 'ፋይት በተሳካ ሁኔታ ተሰርዟል' });
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 5. ADMIN ONLY: አሸናፊ መምረጥ፣ ክፍያ ማከፋፈል፣ ክፍት ግምቶችን መመለስ እና ፋይቱን በራስ-ሰር መሰረዝ
router.post('/:id/declare-winner', requireAdmin, async (req, res) => {
  try {
    const { winner, winnerName } = req.body; // winner: 'red' or 'blue'
    const fightId = req.params.id;

    const fight = await Fight.findById(fightId);
    if (!fight) {
      return res.status(404).json({ message: 'ፋይት አልተገኘም' });
    }

    // ✅ Security: አሸናፊው ቀድሞ ተመርጧል ወይ? (Double Payout መከላከያ)
    if (fight.winner === winner) {
      return res.status(400).json({ 
        message: `አሸናፊው (${winnerName}) አስቀድሞ ተመርጧል። ግምቶች አንድ ጊዜ ብቻ ይከፈላሉ።` 
      });
    }

    // ✅ 1. Find and settle all MATCHED bets for this fight
    const matchedBets = await Bet.find({ event: fightId, status: 'matched' });
    let settledCount = 0;
    
    for (const bet of matchedBets) {
      try {
        await Bet.settleBet(bet._id, winner);
        settledCount++;
      } catch (err) {
        console.error(`Failed to settle bet ${bet._id}:`, err.message);
      }
    }

    // ✅ 2. CRITICAL FIX: Find and REFUND all OPEN bets for this fight
    const openBets = await Bet.find({ event: fightId, status: 'open' });
    let refundedCount = 0;

    for (const bet of openBets) {
      try {
        // Refund the creator atomically
        await User.findByIdAndUpdate(bet.creator, { $inc: { balance: bet.amount } });
        // Mark bet as cancelled
        await Bet.findByIdAndUpdate(bet._id, { status: 'cancelled', updatedAt: Date.now() });
        refundedCount++;
      } catch (err) {
        console.error(`Failed to refund open bet ${bet._id}:`, err.message);
      }
    }

    // ✅ 3. AUTO-DELETE: አሸናፊ ከተመረጠና ክፍያ/መመለስ ከተከናወነ በኋላ ፋይቱን ከዳታቤዝ ሰርዝ
    await Fight.findByIdAndDelete(fightId);

    res.json({ 
      message: `አሸናፊው ${winnerName} ተመርጧል። ${settledCount} የተጣመሩ ግምቶች ተከፍለዋል፣ እና ${refundedCount} ያልተጣመሩ ግምቶች ተመልሰዋል። ፋይቱ በራስ-ሰር ተሰርዟል።`,
      settledCount,
      refundedCount
    });
  } catch (error) {
    console.error('Declare winner error:', error);
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

module.exports = router;
