// --- routes/auth.js ---
const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { logEvents } = require('../middleware/logger');

const router = express.Router();

// Configuration constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

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

  // Check if account is locked but lockout period has expired
  if (user.isLocked && user.lockoutUntil && user.lockoutUntil < new Date()) {
    // Lockout period has expired, unlock the account
    user.isLocked = false;
    user.lockoutUntil = null;
    user.failedAttempts = 0;
    await user.save();
    logEvents(`ACCOUNT UNLOCKED (time-based) for user: ${username}`);
  }

  // Check if account is still locked
  if (user.isLocked) {
    const remainingLockTime = user.lockoutUntil ? 
      Math.ceil((user.lockoutUntil - new Date()) / (1000 * 60)) : 
      LOCKOUT_DURATION_MINUTES;
    
    return res.render('login', {
      error: `Account is locked. Please try again in ${remainingLockTime} minutes or contact support.`,
      lastLogin: user.lastLogin,
      lastFailedLogin: user.lastFailedLogin
    });
  }

  // Now check if password is incorrect
  if (!(await bcrypt.compare(password, user.password))) {
    // Log the failed login attempt
    logEvents(`FAILED LOGIN for user: ${username}`);

    // Record the time of the failed login attempt
    user.lastFailedLogin = new Date();
    user.failedAttempts += 1;

    // Lock account after MAX_LOGIN_ATTEMPTS failed attempts
    if (user.failedAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.isLocked = true;
      // Set lockout expiration time
      const lockoutUntil = new Date();
      lockoutUntil.setMinutes(lockoutUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
      user.lockoutUntil = lockoutUntil;
      
      logEvents(`ACCOUNT LOCKED for user: ${username} until ${lockoutUntil}`);
    }
    
    await user.save();

    return res.render('login', {
      error: 'Invalid username and/or password',
      lastLogin: user.lastLogin,
      lastFailedLogin: user.lastFailedLogin
    });
  }

  // On successful login, reset failed attempts and record last login time
  user.failedAttempts = 0;
  user.lastLogin = new Date();
  user.isLocked = false;
  user.lockoutUntil = null;
  await user.save();

  req.session.user = { id: user._id, role: user.role, username: user.username };

  // Log successful login attempt
  logEvents(`SUCCESSFUL LOGIN for user: ${username}`);

  // Pass the last successful login time to the view
  res.render('dashboard', { 
    user: req.session.user,
    lastLogin: user.lastLogin,
    lastFailedLogin: user.lastFailedLogin
  });
});

router.get('/register', (req, res) => {
  res.render('register', { error: '' }); // Render the register.ejs file
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