const express = require('express');
const Product = require('../models/Product');
const { ensureAuth, ensureRole } = require('../middleware/auth');
const router = express.Router();

router.get('/products', ensureAuth, ensureRole('manager'), async (req, res) => {
    console.log('Session role:', req.session.role); 
  const products = await Product.find({ createdBy: req.session.userId });
  res.render('manager-products', { products });
});

router.get('/products/add', ensureAuth, ensureRole('manager'), (req, res) => {
  res.render('add-product', { error: null });
});

router.post('/products/add', ensureAuth, ensureRole('manager'), async (req, res) => {
  const { name, description, price } = req.body;
  await Product.create({
    name, description, price, createdBy: req.session.userId
  });
  res.redirect('/manager/products');
});

module.exports = router;
