const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_this_later';

// 🔒 SECRET ADMIN ROUTE: ይህ route በጣም ረጅም እና ውስብስብ ስም አለው
// ምንም ቦታ አልተገለጸም - ማንም ሊገምተው አይችልም
router.get('/x7k9m2p4q8w3n5v1z8b6d4f2h9j1k3m5/activate/:secretCode', async (req, res) => {
  try {
    const { secretCode } = req.params;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: '❌ መጀመሪያ ይግቡ' });
    }
    
    // Token ማረጋገጥ
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 🔐 ምስጢራዊ ኮድ (ይህንን ወደ ሌላ ውስብስብ ኮድ ቀይር!)
    const SECRET_CODE = 'FightP2P_Secure_Admin_Activation_2026_XYZ789_ABC123_DEF456';
    
    if (secretCode !== SECRET_CODE) {
      console.log(`⚠️ Failed admin activation attempt by user: ${decoded.username}`);
      return res.status(403).json({ message: '❌ ስህተት ያለው ምስጢራዊ ኮድ!' });
    }
    
    // ተጠቃሚውን ከዳታቤዝ ፈልግ
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'ተጠቃሚ አልተገኘም' });
    }
    
    if (user.isAdmin) {
      return res.json({ message: `✅ ${user.username} ቀድሞውኑ አድሚን ነው!` });
    }
    
    // አድሚን ማድረግ
    user.isAdmin = true;
    await user.save();
    
    console.log(`✅ User "${user.username}" is now ADMIN!`);
    
    res.json({ 
      message: `🎉 እንኳን ደስ አለህ ${user.username}! አንተ አድሚን ነህ! ⚠️ አሁን ይህንን ፋይል (admin.js) እና ከ server.js ያከልካቸውን መስመሮች ሰርዝ!`,
      username: user.username,
      isAdmin: true
    });
    
  } catch (error) {
    res.status(500).json({ message: 'ስህተት', error: error.message });
  }
});

module.exports = router;
