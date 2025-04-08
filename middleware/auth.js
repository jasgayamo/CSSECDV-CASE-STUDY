// --- middleware/auth.js ---
function ensureAuth(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    next();
  }
  
  function ensureRole(role) {
    return (req, res, next) => {
      if (req.session.user?.role !== role) return res.status(403).render('error', { message: 'Forbidden' });
      next();
    };
  }
  
  module.exports = { ensureAuth, ensureRole };