// --- models/User.js ---
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'customer'], required: true },
  failedAttempts: { type: Number, default: 0 },
  isLocked: { type: Boolean, default: false },
  lastLogin: Date,
  lastPasswordChange: Date,
  passwordHistory: [String]
});

userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const hash = await bcrypt.hash(this.password, 12);
    this.password = hash;
    this.passwordHistory.push(hash);
    this.lastPasswordChange = new Date();
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
