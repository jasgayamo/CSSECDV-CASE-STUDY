const express = require('express');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { ensureAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/products', ensureAuth, async (req, res) => {
  if (req.session.role !== 'customer') return res.status(403).send('Access denied');
  const products = await Product.find().populate('createdBy');
  res.render('customer-products', { products });
});

router.post('/order/:productId', ensureAuth, async (req, res) => {
  if (req.session.role !== 'customer') return res.status(403).send('Access denied');
  const productId = req.params.productId;
  await Order.create({ product: productId, customer: req.session.userId });
  res.redirect('/customer/products');
});

module.exports = router;
