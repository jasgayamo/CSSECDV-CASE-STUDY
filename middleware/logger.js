// --- middleware/logger.js ---
const fs = require('fs');
const path = require('path');

function logEvents(message) {
  const logDir = path.join(__dirname, '../logs');
  const logPath = path.join(logDir, 'events.log');
  
  // Create logs directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const log = `${new Date().toISOString()} - ${message}\n`;
  fs.appendFileSync(logPath, log);
}

module.exports = { logEvents };