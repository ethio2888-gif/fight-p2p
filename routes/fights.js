const express = require('express');
const router = express.Router();
const Fight = require('../models/Fight');
const Bet = require('../models/Bet'); // ለውርርድ ክፍያ ተጨምሯል
const User = require('../models/User'); // ለተጠቃሚ ሂሳብ ማሻሻል ተጨምሯል
const { requireAdmin } = require('../middleware/adminMiddleware');

// 🔒 SECURITY FIRST: የግቤት መረጃ ማረጋገጫ (Input Validation)
const validateFightInput = (data) => {
  const errors = [];
  if (!data.fighter1 || !data.fighter1.name) errors.push('የፋይተር 1 ስም ያስፈልጋል');
  if (!data.fighter2 || !data.fighter2.name) errors.push('የፋይተር 2 ስም ያስፈልጋል');
  if (!data.date) {
    errors.push('የፋይት ቀን ያስፈልጋል');
  } else if (isNaN(Date.parse(data.date))) {
    errors.push('ትክክለኛ ያልሆነ የቀን ቅርጸት');
  }
  if (data.fighter1 && data.fighter1.name && data.fighter1.name.length > 50) {
    errors.push('የፋይተር 1 ስም በጣም ረጅም ነው (ከ50 ቁምፊ በታች)');
  }
  if (data.fighter2 && data.fighter2.name && data.fighter2.name.length > 50) {
    errors.push('የፋይተር 2 ስም በጣም ረጅም ነው (ከ50 ቁምፊ በታች)');
  }
  return errors;
};

// 1. PUBLIC: ሁሉንም ፋይቶች ማግኘት (ለፊት-ኤንድ ማሳያ)
router.get('/', async (req, res) => {
  try {
    const fights = await Fight.find().sort({ date: 1 }).select('-bets'); // ቀላል መረጃ ብቻ
    res.json(fights);
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 2. ADMIN ONLY: አዲስ ፋይት መጨመር
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { fighter1, fighter2, date, status } = req.body;
    
    // ✅ Security: Input Validation
    const errors = validateFightInput({ fighter1, fighter2, date });
    if (errors.length > 0) {
      return res.status(400).json({ message: errors.join(', ') });
    }

    const newFight = new Fight({
      fighter1,
      fighter2,
      date,
      status: status || 'upcoming',
      addedBy: req.userId // ከ requireAdmin middleware የተገኘ
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
    
    if (fighter1) updateData.fighter1 = fighter1;
    if (fighter2) updateData.fighter2 = fighter2;
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
    const fight = await Fight.findByIdAndDelete(req.params.id);
    if (!fight) {
      return res.status(404).json({ message: 'ፋይት አልተገኘም' });
    }
    res.json({ message: 'ፋይት በተሳካ ሁኔታ ተሰርዟል' });
  } catch (error) {
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

// 5. ADMIN ONLY: አሸናፊ መምረጥ እና ነጥብ ማከፋፈል (Declare Winner & Payout)
router.post('/:id/declare-winner', requireAdmin, async (req, res) => {
  try {
    const { winner, winnerName, payout } = req.body; // winner: 'fighter1' or 'fighter2'
    const fightId = req.params.id;

    const fight = await Fight.findById(fightId);
    if (!fight) {
      return res.status(404).json({ message: 'ፋይት አልተገኘም' });
    }

    if (fight.status === 'finished') {
      return res.status(400).json({ message: 'ይህ ፋይት አስቀድሞ ተጠናቋል' });
    }

    // ✅ Update fight status and winner
    fight.status = 'finished';
    fight.winner = winner; 
    await fight.save();

    // ✅ Find all winning bets for this fight
    const winningBets = await Bet.find({ fightId, fighterChoice: winner });

    let processedCount = 0;
    for (const bet of winningBets) {
      const user = await User.findById(bet.userId);
      if (user) {
        // Calculate winnings (bet amount * payout multiplier)
        const winnings = bet.amount * payout;
        user.balance = (user.balance || 0) + winnings;
        await user.save();
        
        // Update bet status
        bet.status = 'won';
        bet.payoutAmount = winnings;
        await bet.save();
        
        processedCount++;
      }
    }

    // ✅ Update losing bets status
    await Bet.updateMany(
      { fightId, fighterChoice: { $ne: winner } },
      { status: 'lost' }
    );

    res.json({ 
      message: `አሸናፊው ${winnerName} ተመርጧል። ${processedCount} ውርርዶች ተከፍለዋል።`,
      fight,
      processedCount
    });
  } catch (error) {
    console.error('Declare winner error:', error);
    res.status(500).json({ message: 'የሰርቨር ስህተት', error: error.message });
  }
});

module.exports = router;
