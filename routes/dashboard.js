// --- routes/dashboard.js ---
const express = require('express');
const { ensureAuth } = require('../middleware/auth');
const User = require('../models/User'); // Import the User model
const router = express.Router();

router.get('/', ensureAuth, async (req, res) => {
  try {
    // Get the current user's information from the database
    const user = await User.findById(req.session.user.id);
    
    res.render('dashboard', { 
      user: req.session.user,
      lastLogin: user.lastLogin,
      lastFailedLogin: user.lastFailedLogin
    });
  } catch (err) {
    console.error('Error fetching user details:', err);
    res.render('dashboard', { 
      user: req.session.user,
      lastLogin: null,
      lastFailedLogin: null
    });
  }
});

module.exports = router;