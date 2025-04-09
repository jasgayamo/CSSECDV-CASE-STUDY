// --- routes/auth.js ---
const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { logEvents } = require('../middleware/logger');

const router = express.Router();

router.get('/login', (req, res) => {
  res.render('login', {
    error: '',
    lastLogin: null,
    lastFailedLogin: null
  });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });

  // First check if user exists
  if (!user) {
    // Log the failed login attempt for non-existent user
    logEvents(`FAILED LOGIN for non-existent user: ${username}`);
    return res.render('login', {
      error: 'Invalid username and/or password',
      lastLogin: null,
      lastFailedLogin: null
    });
  }

  // Now check if account is locked or password is incorrect
  if (user.isLocked || !(await bcrypt.compare(password, user.password))) {
    // Log the failed login attempt
    logEvents(`FAILED LOGIN for user: ${username}`);

    // Record the time of the failed login attempt
    user.lastFailedLogin = new Date();
    user.failedAttempts += 1;

    // Lock account after 5 failed attempts
    if (user.failedAttempts >= 5) user.isLocked = true;
    await user.save();

    return res.render('login', {
      error: 'Invalid username and/or password',
      lastLogin: user.lastLogin,  // Make sure to include lastLogin here!
      lastFailedLogin: user.lastFailedLogin
    });
  }

  // On successful login, reset failed attempts and record last login time
  user.failedAttempts = 0;
  user.lastLogin = new Date();
  await user.save();

  req.session.user = { id: user._id, role: user.role, username: user.username };

  // Log successful login attempt
  logEvents(`SUCCESSFUL LOGIN for user: ${username}`);

  // Pass the last successful login time to the view
  // In auth.js, at the end of your POST /login route
  res.render('dashboard', { 
  user: req.session.user,  // Add this line
  lastLogin: user.lastLogin,
  lastFailedLogin: user.lastFailedLogin
});
});

router.post('/register', async (req, res) => {
  const { username, password, confirmPassword, role, securityQuestion, securityAnswer } = req.body;
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

  try {
    if (password !== confirmPassword) {
      return res.render('register', { error: 'Passwords do not match.' });
    }

    if (!passwordRegex.test(password)) {
      return res.render('register', {
        error: 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.'
      });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.render('register', { error: 'Username already exists' });
    }

    const user = new User({ username, password, role, securityQuestion, securityAnswer });
    await user.save();
    logEvents(`NEW USER REGISTERED: ${username}`);
    res.redirect('/login');
  } catch (err) {
    logEvents(`REGISTRATION ERROR for user: ${username} - ${err.message}`);
    res.render('register', { error: 'Registration failed. Please try again.' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;