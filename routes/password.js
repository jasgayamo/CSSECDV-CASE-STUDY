const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { logEvents } = require('../middleware/logger');
const router = express.Router();

router.get('/change', (req, res) => {
  res.render('change-password', { error: null });
});

router.post('/change', async (req, res) => {
  const { username, securityAnswer, newPassword, confirmNewPassword } = req.body;
  const user = await User.findOne({ username });

  if (!user) return res.render('change-password', { error: 'User not found.' });

  // Check if 24 hours have passed since the last password change
  const hoursSinceLastChange = (Date.now() - user.passwordLastChanged) / (1000 * 60 * 60); // Convert to hours
  if (hoursSinceLastChange < 24) {
    return res.render('change-password', { error: 'You can only change your password once every 24 hours.' });
  }

  const isAnswerCorrect = await bcrypt.compare(securityAnswer, user.securityAnswer);

  if (!isAnswerCorrect) return res.render('change-password', { error: 'Incorrect security answer.' });
  if (newPassword !== confirmNewPassword) return res.render('change-password', { error: 'Passwords do not match.' });

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return res.render('change-password', {
      error: 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.'
    });
  }

  // Check password history
  const hasBeenUsed = await Promise.all(
    user.passwordHistory.map(async (oldHash) => await bcrypt.compare(newPassword, oldHash))
  );
  if (hasBeenUsed.includes(true)) {
    return res.render('change-password', {
      error: 'New password must not match any previously used password.'
    });
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  user.password = newHash;  // Updated with hashed password
  user.passwordHistory.push(newHash);

  // Maintain a history of a maximum of 5 passwords
  if (user.passwordHistory.length > 5) {
    user.passwordHistory = user.passwordHistory.slice(-5);
  }

  // Set the new password change timestamp
  user.passwordLastChanged = Date.now(); // Update the password last changed timestamp

  await user.save();
  logEvents(`PASSWORD CHANGED for user: ${username}`);
  res.redirect('/login');
});

module.exports = router;