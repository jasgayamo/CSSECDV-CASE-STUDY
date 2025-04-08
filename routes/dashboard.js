// --- routes/dashboard.js ---
const express = require('express');
const { ensureAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', ensureAuth, (req, res) => {
  res.render('dashboard', { user: req.session.user });
});

module.exports = router;