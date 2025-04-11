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
      logEvents(`ORDER NOT PLACED - Product: ${product.name} (ID: ${productId}) by ${sessionUser.username} (ID: ${sessionUser._id})`);
      return res.redirect('/customer/products?error=Invalid credentials. Order not placed.');
      
    }

    if (sessionUser.role !== 'customer') {
      logEvents(`ORDER NOT PLACED - Product: ${product.name} (ID: ${productId}) by ${sessionUser.username} (ID: ${sessionUser._id})`);
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

    res.redirect('/customer/products?message=Order placed successfully!');
  } catch (err) {
    console.error('Error placing order:', err);
    res.redirect('/customer/products?error=Order failed.');
  }
});

router.get('/orders', ensureAuth, ensureRole('customer'), async (req, res) => {
  try {
    const userId = req.session.user._id;
    
    // Fetch all orders for the logged-in customer and populate product info
    const orders = await Order.find({ customer: userId }).populate('product');
    logEvents(`ORDERS VIEWED by ${req.session.user.username} (ID: ${userId})`);

    // Extract error and message from query string and pass them to the view
    const { error, message } = req.query;
    
    // Pass orders, error, and message to the template
    res.render('customer-orders', { orders, error, message });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).send('Internal server error');
  }
});


router.post('/order/:orderId/delete', ensureAuth, ensureRole('customer'), async (req, res) => {
  const { orderId } = req.params;
  const { username, password } = req.body;
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MINUTES = 30;

  try {
    const sessionUser = await User.findById(req.session.user._id);
    if (!sessionUser) {
      return res.redirect('/customer/orders?error=Unauthorized.');
    }

    if (sessionUser.isLocked && sessionUser.lockoutUntil && sessionUser.lockoutUntil > new Date()) {
      const remaining = Math.ceil((sessionUser.lockoutUntil - new Date()) / 60000);
      return res.redirect(`/customer/orders?error=Account locked. Try again in ${remaining} minute(s).`);
    }

    if (sessionUser.username !== username) {
      sessionUser.failedAttempts += 1;
      sessionUser.lastFailedLogin = new Date();

      if (sessionUser.failedAttempts >= MAX_ATTEMPTS) {
        sessionUser.isLocked = true;
        const lockoutUntil = new Date();
        lockoutUntil.setMinutes(lockoutUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
        sessionUser.lockoutUntil = lockoutUntil;

        logEvents(`ACCOUNT LOCKED (username mismatch) during delete for user: ${sessionUser.username} until ${lockoutUntil}`);
        await sessionUser.save();
        req.session.destroy(() => {
          logEvents(`AUTO-LOGOUT: Locked user (${sessionUser.username}) tried to delete order.`);
          return res.redirect(`/customer/orders?error=Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.`);
        });
        return;
      }

      await sessionUser.save();
      return res.redirect('/customer/orders?error=Invalid credentials. Order not deleted.');
    }

    const isMatch = await bcrypt.compare(password, sessionUser.password);
    if (!isMatch) {
      sessionUser.failedAttempts += 1;
      sessionUser.lastFailedLogin = new Date();

      if (sessionUser.failedAttempts >= MAX_ATTEMPTS) {
        sessionUser.isLocked = true;
        const lockoutUntil = new Date();
        lockoutUntil.setMinutes(lockoutUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
        sessionUser.lockoutUntil = lockoutUntil;

        logEvents(`ACCOUNT LOCKED (password mismatch) during delete for user: ${sessionUser.username} until ${lockoutUntil}`);
      }

      await sessionUser.save();
      return res.redirect('/customer/orders?error=Invalid credentials. Order not deleted.');
    }

    // Unlock if lock expired and credentials are good
    if (sessionUser.isLocked && sessionUser.lockoutUntil < new Date()) {
      sessionUser.isLocked = false;
      sessionUser.lockoutUntil = null;
      sessionUser.failedAttempts = 0;
      await sessionUser.save();
      logEvents(`ACCOUNT UNLOCKED (time-based) during delete: ${sessionUser.username}`);
    }

    const order = await Order.findById(orderId).populate('product');
    if (!order) {
      return res.redirect('/customer/orders?error=Order not found.');
    }

    if (order.customer.toString() !== sessionUser._id.toString()) {
      return res.redirect('/customer/orders?error=Unauthorized action.');
    }

    await Order.findByIdAndDelete(orderId);
    logEvents(`ORDER DELETED - Product: ${order.product.name} (ID: ${order.product._id}) by ${sessionUser.username} (ID: ${sessionUser._id})`);

    // Reset lockout status after successful action
    sessionUser.failedAttempts = 0;
    sessionUser.isLocked = false;
    sessionUser.lockoutUntil = null;
    sessionUser.lastLogin = new Date();
    await sessionUser.save();

    return res.redirect('/customer/orders?message=Order deleted successfully.');
  } catch (err) {
    console.error('Error deleting order:', err);
    return res.redirect('/customer/orders?error=Error deleting order.');
  }
});





module.exports = router;
