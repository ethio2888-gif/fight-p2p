const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'ትክክለኛ የኢሜይል አድራሻ ያስገቡ']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  balance: {
    type: Number,
    default: 1000 // ✅ ማስተካከያ: ከ 0 ወደ 1000 ተቀይሯል!
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// የይለፍ ቃልን ከመመዝገቡ በፊት Hash ማድረግ (ለደህንነት)
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// የተጠቃሚውን የይለፍ ቃል ከገባው ጋር ለማነፃፀር
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
