// --- routes/auth.js ---
const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { logEvents } = require('../middleware/logger');

const router = express.Router();

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || user.isLocked || !(await bcrypt.compare(password, user.password))) {
    logEvents(`FAILED LOGIN for user: ${username}`);
    if (user) {
      user.failedAttempts += 1;
      if (user.failedAttempts >= 5) user.isLocked = true;
      await user.save();
    }
    return res.render('login', { error: 'Invalid username and/or password' });
  }

  user.failedAttempts = 0;
  user.lastLogin = new Date();
  await user.save();
  req.session.user = { id: user._id, role: user.role, username: user.username };
  logEvents(`SUCCESSFUL LOGIN for user: ${username}`);
  res.redirect('/dashboard');
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

router.get('/register', (req, res) => {
    res.render('register', { error: null });
  });
  
  router.post('/register', async (req, res) => {
    const { username, password, role } = req.body;
    try {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.render('register', { error: 'Username already exists' });
      }
      const user = new User({ username, password, role });
      await user.save();
      logEvents(`NEW USER REGISTERED: ${username}`);
      res.redirect('/login');
    } catch (err) {
      logEvents(`REGISTRATION ERROR for user: ${username} - ${err.message}`);
      res.render('register', { error: 'Registration failed. Please try again.' });
    }
  });

module.exports = router;