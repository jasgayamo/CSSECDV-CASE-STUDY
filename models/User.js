// --- models/User.js ---
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'customer'], required: true },
  failedAttempts: { type: Number, default: 0 },
  isLocked: { type: Boolean, default: false },
  lockoutUntil: { type: Date, default: null },  
  lastLogin: Date,
  lastFailedLogin: Date,
  passwordLastChanged: Date,
  passwordHistory: [String],
  securityQuestion: { type: String, required: true },
  securityAnswer: { type: String, required: true }
});

userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const hash = await bcrypt.hash(this.password, 12);
    this.password = hash;
    this.passwordHistory.push(hash);
    this.lastPasswordChange = new Date();
  }
  if (this.isModified('securityAnswer')) {
    this.securityAnswer = await bcrypt.hash(this.securityAnswer, 10);
  }
  next();
});

module.exports = mongoose.model('User', userSchema);