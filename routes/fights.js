const express = require('express');
const router = express.Router();
const Fight = require('../models/Fight');
const Bet = require('../models/Bet');
const User = require('../models/User');
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
    // 🚀 HIGH TRAFFIC: Limit results & 🆕 Populate organization name
    const fights = await Fight.find()
      .populate('organization', 'name') 
      .sort({ date: 1 }) // ቀጣይ ፋይቶች መጀመሪያ፣ የተጠናቀቁት መጨረሻ ላይ
      .limit(100) 
      .select('-bets');
    
    res.json(fights);
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 🆕 2. PUBLIC: Get Fighter History and Stats (Auto-calculated from past fights)
router.get('/fighter-history', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, message: 'የፋይተር ስም ያስፈልጋል' });
    }

    const fighterName = name.trim();

    // 🚀 HIGH TRAFFIC: Find finished fights involving this fighter, sorted by newest first
    const fights = await Fight.find({
      status: 'finished',
      $or: [
        { 'fighter1.name': fighterName },
        { 'fighter2.name': fighterName }
      ]
    }).sort({ date: -1 }).limit(20); 

    let wins = 0;
    let losses = 0;
    let draws = 0;
    const history = [];

    fights.forEach(fight => {
      const isFighter1 = fight.fighter1.name === fighterName;
      const opponent = isFighter1 ? fight.fighter2.name : fight.fighter1.name;
      const opponentRecord = isFighter1 ? fight.fighter2.record : fight.fighter1.record;
      
      let result = 'Draw';
      if (fight.winner === 'draw') {
        draws++;
        result = 'Draw';
      } else if ((fight.winner === 'red' && isFighter1) || (fight.winner === 'blue' && !isFighter1)) {
        wins++;
        result = 'Win';
      } else {
        losses++;
        result = 'Loss';
      }

      history.push({
        date: fight.date,
        opponent: opponent,
        opponentRecord: opponentRecord,
        result: result
      });
    });

    const upcomingFights = await Fight.find({
      status: { $in: ['upcoming', 'live'] },
      $or: [
        { 'fighter1.name': fighterName },
        { 'fighter2.name': fighterName }
      ]
    }).sort({ date: 1 }).limit(1);

    res.json({
      success: true,
      data: {
        name: fighterName,
        stats: {
          total: fights.length,
          wins,
          losses,
          draws
        },
        history,
        nextFight: upcomingFights.length > 0 ? upcomingFights[0] : null
      }
    });
  } catch (error) {
    console.error('Fighter history error:', error);
    res.status(500).json({ success: false, message: 'የሰርቨር ስህተት' });
  }
});

// 3. ADMIN ONLY: አዲስ ፋይት መጨመር
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { fighter1, fighter2, date, status, organization } = req.body;
    
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
      organization: organization || null, 
      addedBy: req.userId
    });

    await newFight.save();
    res.status(201).json({ message: 'ፋይት በተሳካ ሁኔታ ተጨምሯል', fight: newFight });
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 4. ADMIN ONLY: ፋይት ማስተካከል (Update)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { fighter1, fighter2, date, status, winner, organization } = req.body;
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
    if (organization !== undefined) updateData.organization = organization; 

    const fight = await Fight.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (!fight) {
      return res.status(404).json({ message: 'ፋይት አልተገኘም' });
    }

    res.json({ message: 'ፋይት በተሳካ ሁኔታ ተስተካክሏል', fight });
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 5. ADMIN ONLY: ፋይት መሰረዝ (Delete)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
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

// 6. ADMIN ONLY: አሸናፊ መምረጥ፣ ክፍያ ማከፋፈል፣ ክፍት ግምቶችን መመለስ እና ፋይቱን ማስተካከል (አይሰረዝም!)
router.post('/:id/declare-winner', requireAdmin, async (req, res) => {
  try {
    const { winner, winnerName } = req.body;
    const fightId = req.params.id;

    const fight = await Fight.findById(fightId);
    if (!fight) {
      return res.status(404).json({ message: 'ፋይት አልተገኘም' });
    }

    if (fight.status === 'finished') {
      return res.status(400).json({ 
        message: `ይህ ፋይት አስቀድሞ ተጠናቅቋል።` 
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
        await User.findByIdAndUpdate(bet.creator, { $inc: { balance: bet.amount } });
        await Bet.findByIdAndUpdate(bet._id, { status: 'cancelled', updatedAt: Date.now() });
        refundedCount++;
      } catch (err) {
        console.error(`Failed to refund open bet ${bet._id}:`, err.message);
      }
    }

    // ✅ 3. UPDATE FIGHT STATUS INSTEAD OF DELETING (ለ24 ሰዓት ኮሜንት እንዲኖር)
    fight.status = 'finished';
    fight.winner = winner;
    fight.finishedAt = new Date(); // 🆕 የተጠናቀቀበትን ሰዓት ያስቀምጣል
    
    await fight.save();

    res.json({ 
      message: `አሸናፊው ${winnerName} ተመርጧል። ${settledCount} የተጣመሩ ግምቶች ተከፍለዋል፣ እና ${refundedCount} ያልተጣመሩ ግምቶች ተመልሰዋል። ፋይቱ ወደ "Recently Finished" ተዛውሯል።`,
      settledCount,
      refundedCount
    });
  } catch (error) {
    console.error('Declare winner error:', error);
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

module.exports = router;
