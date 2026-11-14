const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'] // 🔒 Upgraded from 6 to 8
  },
  balance: {
    type: Number,
    default: 1000,
    min: [0, 'Balance cannot be negative'] // 🔒 Prevents negative balance exploits
  },
  lastDailyBonus: {
    type: Date,
    default: null
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 🔒 SECURITY FIRST: Automatically remove password and __v from JSON responses
userSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12); // 🔒 Upgraded salt rounds from 10 to 12 for better security
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// 🚀 HIGH TRAFFIC: Add indexes for faster queries (Login, Leaderboard)
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ balance: -1 }); // Descending order for Leaderboard performance

module.exports = mongoose.model('User', userSchema);
