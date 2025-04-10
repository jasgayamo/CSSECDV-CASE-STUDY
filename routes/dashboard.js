// --- routes/dashboard.js ---
const express = require('express');
const { ensureAuth } = require('../middleware/auth');
const User = require('../models/User'); // Import the User model
const router = express.Router();

router.get('/', ensureAuth, async (req, res) => {
  try {
    // Get the current user's information from the database
    const user = await User.findById(req.session.user._id);
    
    // Render the dashboard with the user and other information
    res.render('dashboard', { 
      user,
      lastLogin: user.lastLogin,
      lastFailedLogin: user.lastFailedLogin,
      error: null // No error in this case
    });
  } catch (err) {
    console.error('Error fetching user details:', err);

    // Render the dashboard with a custom error message
    res.render('dashboard', { 
      user: req.session.user,
      lastLogin: null,
      lastFailedLogin: null,
      error: 'There was an issue fetching your details. Please try again later.' // Pass error message
    });
  }
});

module.exports = router;
