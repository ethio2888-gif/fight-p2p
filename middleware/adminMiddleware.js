const jwt = require('jsonwebtoken');

// JWT Secret (ከ auth.js ጋር ተመሳሳይ መሆን አለበት)
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_this_later';

// 🔒 SECURITY FIRST: አድሚን ብቻ የሚደርሱበት ሚድልዌር
const requireAdmin = (req, res, next) => {
  try {
    // 1. Token ከ Header መኖሩን ማረጋገጥ
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

    if (!token) {
      return res.status(401).json({ message: 'መግቢያ (Token) የለም። እባክዎ ይግቡ' });
    }

    // 2. Token ትክክለኛ መሆኑን ማረጋገጥ (Signature verification)
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 3. 🔑 CRITICAL: ተጠቃሚው አድሚን መሆኑን ማረጋገጥ
    if (!decoded.isAdmin) {
      return res.status(403).json({ message: '❌ መብት የለዎትም። ይህ አገልግሎት ለአድሚኖች ብቻ ነው።' });
    }

    // 4. የተጠቃሚውን መረጃ ለቀጣይ ራውቶች ማስተላለፍ
    req.userId = decoded.userId;
    req.username = decoded.username;
    req.isAdmin = decoded.isAdmin;

    // ወደ ቀጣዩ ራውት (Route) መሄድ
    next();
  } catch (error) {
    // Token ከከሰመ ወይም ልክ ካልሆነ
    return res.status(403).json({ message: 'ልክ ያልሆነ ወይም የከሰመ መግቢያ (Invalid or expired token)' });
  }
};

module.exports = { requireAdmin };
