// --- app.js ---
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const morgan = require('morgan');
const path = require('path');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const passwordRoutes = require('./routes/password');
const managerRoutes = require('./routes/manager');
const customerRoutes = require('./routes/customer');
const { logEvents } = require('./middleware/logger');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/securewebapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Session Setup
app.use(session({
  secret: 'secureSecret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: 'mongodb://localhost:27017/securewebapp' }),
  cookie: { maxAge: 1000 * 60 * 60 }
}));

// Routes
app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/admin', adminRoutes);
app.use('/password', passwordRoutes);
app.use('/manager', managerRoutes);
app.use('/customer', customerRoutes);

// Error Page
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found' });
});

app.listen(3000, () => console.log('Server started on port 3000'));
