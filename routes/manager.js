const express = require('express');
const Product = require('../models/Product');
const { ensureAuth, ensureRole } = require('../middleware/auth');
const { logEvents } = require('../middleware/logger');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const router = express.Router();

// Display all products for the logged-in manager
router.get('/products', ensureAuth, ensureRole('manager'), async (req, res) => {
  const products = await Product.find({ createdBy: req.session.user._id });
  res.render('manager-products', { products });
});

// Display the product add form
router.get('/products/add', ensureAuth, ensureRole('manager'), (req, res) => {
  res.render('add-product', { error: null, message: null });
});

// Handle the addition of a new product
router.post('/products/add', ensureAuth, ensureRole('manager'), async (req, res) => {
  const { name, description, price, username, password } = req.body;
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MINUTES = 30;

  try {
    const user = await User.findOne({ username });

    if (!user) {
      return res.render('add-product', { error: 'Invalid credentials. Product not added.', message: null });
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
        
        logEvents(`ACCOUNT LOCKED (mismatch) during product-add for user: ${sessionUser.username} until ${lockoutUntil}`);
        req.session.destroy(() => {
          return res.render('add-product', {
            error: 'Too many failed attempts. Account locked.',
            message: `Your account has been locked for ${LOCKOUT_DURATION_MINUTES} minutes.`
          });
        });
        await sessionUser.save();
        return;
      }

      await sessionUser.save();
      return res.render('add-product', {
        error: sessionUser.isLocked
          ? `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.`
          : 'Invalid credentials. Product not added.',
        message: null
      });
    }

    if (sessionUser.isLocked && sessionUser.lockoutUntil && sessionUser.lockoutUntil < new Date()) {
      sessionUser.isLocked = false;
      sessionUser.lockoutUntil = null;
      sessionUser.failedAttempts = 0;
      await sessionUser.save();
      logEvents(`ACCOUNT UNLOCKED (time-based) for product-add attempt: ${sessionUser.username}`);
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
        logEvents(`ACCOUNT LOCKED during product-add for user: ${sessionUser.username} until ${lockoutUntil}`);
      }

      await sessionUser.save();
      return res.render('add-product', {
        error: sessionUser.isLocked
          ? `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.`
          : 'Invalid credentials. Product not added.',
        message: null
      });
    }

    sessionUser.failedAttempts = 0;
    sessionUser.isLocked = false;
    sessionUser.lockoutUntil = null;
    await sessionUser.save();

    const product = await Product.create({
      name,
      description,
      price,
      createdBy: sessionUser._id
    });

    logEvents(`PRODUCT CREATED - Name: ${product.name}, By: ${sessionUser.username} (ID: ${sessionUser._id})`);
    res.render('add-product', {
      error: null,
      message: `Product ${product.name} added successfully!`
    });

  } catch (err) {
    console.error('Error creating product:', err);
    res.render('add-product', { error: 'Failed to create product.', message: null });
  }
});



// Handle the update of the product
router.post('/products/edit/:id', ensureAuth, ensureRole('manager'), async (req, res) => {
  const { name, description, price } = req.body;

  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (product.createdBy.toString() !== req.session.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'User does not have permission' });
    }

    product.name = name;
    product.description = description;
    product.price = price;

    await product.save();

    logEvents(`PRODUCT UPDATED - Name: ${product.name}, By: ${req.session.user.username} (ID: ${req.session.user._id})`);

    res.json({ success: true, message: 'Product updated successfully' });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ success: false, message: 'Failed to update product' });
  }
});




// Delete product route
router.post('/products/delete/:id', ensureAuth, ensureRole('manager'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id); // Changed _id to id

    if (!product || product.createdBy.toString() !== req.session.user._id.toString()) {
      return res.redirect('/manager/products');  // Redirecting to the manager-products page
    }

    await product.remove();
    logEvents(`PRODUCT DELETED - Name: ${product.name}, By: ${req.session.user.username} (ID: ${req.session.user._id})`);

    res.json({ success: true, message: 'Product updated successfully' });
    // Redirect to the manager-products page after deletion
  } catch (err) {
    console.error('Error deleting product:', err);
    res.redirect('/manager/products');  // Redirect to the manager-products page on error
  }
});



module.exports = router;
