const express = require('express');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const { ensureAuth, ensureRole } = require('../middleware/auth');
const { logEvents } = require('../middleware/logger');
const router = express.Router();

// Define constants for maximum failed login attempts and lockout duration
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

// Ensure user is authenticated and is a 'customer' for product access
router.get('/products', ensureAuth, ensureRole('customer'), async (req, res) => {
  try {
    const products = await Product.find().populate('createdBy');
    logEvents(`PRODUCTS VIEWED by ${req.session.user.username} (ID: ${req.session.user._id})`);

    // ✅ Extract error and message from the query string and pass them to the view
    const { error, message } = req.query;
    res.render('customer-products', { products, error, message });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).send('Internal server error');
  }
});


// Ensure user is authenticated and is a 'customer' for placing an order
router.post('/order/:productId', ensureAuth, ensureRole('customer'), async (req, res) => {
  const productId = req.params.productId;
  const { username, password } = req.body;
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MINUTES = 30;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.redirect('/customer/products?error=Invalid credentials. Order not placed.');
    }

    const sessionUser = await User.findById(req.session.user._id);

    if (sessionUser._id.toString() !== user._id.toString()) {
      sessionUser.failedAttempts += 1;
      sessionUser.lastFailedLogin = new Date();

      if (sessionUser.failedAttempts >= MAX_ATTEMPTS) {
        sessionUser.isLocked = true;
        const lockoutUntil = new Date();
        lockoutUntil.setMinutes(lockoutUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
        sessionUser.lockoutUntil = lockoutUntil;

        logEvents(`ACCOUNT LOCKED (mismatch) during order for user: ${sessionUser.username} until ${lockoutUntil}`);
        req.session.destroy(() => {
          logEvents(`AUTO-LOGOUT: Locked user (${sessionUser.username}) tried to place order.`);
          return res.redirect(`/customer/products?error=Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.`);
        });
        await sessionUser.save();
        return;
      }

      await sessionUser.save();
      return res.redirect('/customer/products?error=Invalid credentials. Order not placed.');
    }

    if (sessionUser.isLocked && sessionUser.lockoutUntil && sessionUser.lockoutUntil < new Date()) {
      sessionUser.isLocked = false;
      sessionUser.lockoutUntil = null;
      sessionUser.failedAttempts = 0;
      await sessionUser.save();
      logEvents(`ACCOUNT UNLOCKED (time-based) during order: ${sessionUser.username}`);
    }

    if (sessionUser.isLocked) {
      const remaining = Math.ceil((sessionUser.lockoutUntil - new Date()) / 60000);
      return res.redirect(`/customer/products?error=Account locked. Try again in ${remaining} minute(s).`);
    }

    const match = await bcrypt.compare(password, sessionUser.password);
    if (!match) {
      sessionUser.failedAttempts += 1;
      sessionUser.lastFailedLogin = new Date();

      if (sessionUser.failedAttempts >= MAX_ATTEMPTS) {
        sessionUser.isLocked = true;
        const lockoutUntil = new Date();
        lockoutUntil.setMinutes(lockoutUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
        sessionUser.lockoutUntil = lockoutUntil;
        logEvents(`ACCOUNT LOCKED during order for user: ${sessionUser.username} until ${lockoutUntil}`);
      }

      await sessionUser.save();
      return res.redirect('/customer/products?error=Invalid credentials. Order not placed.');
    }

    if (sessionUser.role !== 'customer') {
      return res.redirect('/customer/products?error=Unauthorized: Only customers can place orders.');
    }

    sessionUser.failedAttempts = 0;
    sessionUser.isLocked = false;
    sessionUser.lockoutUntil = null;
    sessionUser.lastLogin = new Date();
    await sessionUser.save();

    const product = await Product.findById(productId);
    if (!product) {
      return res.redirect('/customer/products?error=Product not found.');
    }

    const order = await Order.create({ product: productId, customer: sessionUser._id });
    logEvents(`ORDER PLACED - Product: ${product.name} (ID: ${productId}) by ${sessionUser.username} (ID: ${sessionUser._id})`);

    res.redirect('/customer/products');
  } catch (err) {
    console.error('Error placing order:', err);
    res.redirect('/customer/products?error=Order failed.');
  }
});



module.exports = router;
