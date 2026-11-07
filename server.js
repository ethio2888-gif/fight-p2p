const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI)
  .then(() => console.log('✅ MongoDB Connected Successfully!'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// In-memory data storage (will replace with MongoDB later)
let fights = [
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

// API Routes
app.get('/api/fights', (req, res) => {
  res.json(fights);
});

app.get('/api/users', (req, res) => {
  res.json(users);
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('place_bet', (data) => {
    const fight = fights.find(f => f.id === data.fightId);
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

server.listen(PORT, () => {
  console.log(`Fight P2P server running on port ${PORT}`);
});
