require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');

// 1. MongoDB Connection
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI)
  .then(() => console.log('✅ MongoDB Connected Successfully!'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Render default port is often 10000, fallback to 3000 for local
const PORT = process.env.PORT || 10000;

// 2. Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 3. Import Models
const Organization = require('./models/Organization');
const Event = require('./models/Event');
const Bet = require('./models/Bet');
const Fight = require('./models/Fight'); // ✅ አዲስ: Fight Model

// 4. Import Routes
const authRoutes = require('./routes/auth');
const betRoutes = require('./routes/bet'); 
const adRoutes = require('./routes/ads'); 
const leaderboardRoutes = require('./routes/leaderboard'); 
const dailyBonusRoutes = require('./routes/dailyBonus');
const fightRoutes = require('./routes/fights'); // ✅ አዲስ: Fight Routes

// 5. Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/bets', betRoutes); 
app.use('/api/ads', adRoutes); 
app.use('/api/leaderboard', leaderboardRoutes); 
app.use('/api/daily-bonus', dailyBonusRoutes);
app.use('/api/fights', fightRoutes); // ✅ አዲስ: Fight Routes መጠቀም (ይህ ከዳታቤዝ ያነባል)

// =================================================================
// ለአሁኑ የቆየ (Legacy) ኮድ - ለ Socket.io ሙከራ እስኪፈልጉት ድረስ ይቆያል
// ማሳሰቢያ: /api/fights ጥያቄ አሁን ከላይ ባለው fightRoutes ይያዛል (ከዳታቤዝ)
// =================================================================
let legacyFights = [
  {
    id: 1,
    fighter1: { name: 'Ethiopian Lion', record: '15-2-0', photo: '🦁' },
    fighter2: { name: 'African Thunder', record: '12-3-1', photo: '⚡' },
    date: '2026-11-15',
    status: 'upcoming',
    bets: []
  },
  {
    id: 2,
    fighter1: { name: 'Addis Warrior', record: '10-1-0', photo: '🛡️' },
    fighter2: { name: 'Nile Storm', record: '8-4-2', photo: '🌊' },
    date: '2026-11-20',
    status: 'upcoming',
    bets: []
  }
];

let users = [];

// ማሳሰቢያ: ይህ መስመር ተወግዷል ምክንያቱም አሁን `fightRoutes` `/api/fights`ን ይይዛል
// app.get('/api/fights', (req, res) => { res.json(fights); });

app.get('/api/users', (req, res) => {
  res.json(users);
});

// Socket.io for real-time updates (እስካሁን legacyFightsን ይጠቀማል)
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('place_bet', (data) => {
    const fight = legacyFights.find(f => f.id === data.fightId);
    if (fight) {
      fight.bets.push({
        userId: socket.id,
        fighter: data.fighter,
        amount: data.amount,
        timestamp: new Date()
      });
      io.emit('bet_placed', { fightId: data.fightId, bet: fight.bets[fight.bets.length - 1] });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});
// =================================================================

// 6. Start Server
server.listen(PORT, () => {
  console.log(`🚀 Fight P2P server running on port ${PORT}`);
});
