const express = require('express');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { ensureAuth, ensureRole } = require('../middleware/auth');
const { logEvents } = require('../middleware/logger');
const router = express.Router();

// Ensure user is authenticated and is a 'customer' for product access
router.get('/products', ensureAuth, ensureRole('customer'), async (req, res) => {
  try {
    const products = await Product.find().populate('createdBy');
    logEvents(`PRODUCTS VIEWED by ${req.session.user.username} (ID: ${req.session.user._id})`);

    res.render('customer-products', { products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).send('Internal server error');
  }
});

// Ensure user is authenticated and is a 'customer' for placing an order
router.post('/order/:productId', ensureAuth, ensureRole('customer'), async (req, res) => {
  const productId = req.params.productId;

  try {
    const product = await Product.findById(productId);
    await Order.create({ product: productId, customer: req.session.user._id });

    logEvents(`ORDER PLACED - Product: ${product.name} (ID: ${productId}) by ${req.session.user.username} (ID: ${req.session.user._id})`);
    res.redirect('/customer/products');
  } catch (err) {
    console.error('Error placing order:', err);
    res.status(500).send('Order failed');
  }
});

module.exports = router;
