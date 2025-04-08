// --- routes/admin.js ---
const express = require('express');
const fs = require('fs');
const path = require('path');
const { ensureAuth, ensureRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', ensureAuth, ensureRole('admin'), (req, res) => {
  const logPath = path.join(__dirname, '../logs/events.log');
  const logs = fs.readFileSync(logPath, 'utf8');
  res.render('admin', { logs });
});

module.exports = router;
