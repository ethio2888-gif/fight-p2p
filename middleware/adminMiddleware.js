const jwt = require('jsonwebtoken');

// 🔒 SECURITY FIRST: JWT Secret MUST be loaded from Environment Variables (No fallback)
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('⚠️ CRITICAL: JWT_SECRET is not defined in Environment Variables! Admin middleware will fail securely.');
}

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
    // 🔒 SECURITY FIRST: Differentiate between expired and invalid tokens
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'መግቢያዎ አልቋል። እባክዎ እንደገና ይግቡ' });
    }
    return res.status(403).json({ message: 'ልክ ያልሆነ ወይም የከሰመ መግቢያ (Invalid or expired token)' });
  }
};

module.exports = { requireAdmin };
