// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth.routes');
// const listingRoutes = require('./routes/listing.routes');
const onboardingRoutes = require('./routes/onboarding.routes');
const eventRoutes = require('./routes/event.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const accountRoutes = require('./routes/account.routes');
const carRoutes = require('./routes/car.routes');
const adminRoutes = require('./routes/admin.routes');
const uploadRoutes = require('./routes/upload.routes');
const devRoutes = require('./routes/dev.routes');
const propertyRoutes = require('./routes/property.routes');
const projectRoutes = require('./routes/project.routes');
const packagesRoutes = require('./routes/packages.routes');
const siteRoutes = require('./routes/site.routes');
const paymentRoutes = require('./routes/payment.routes');
const nafathRoutes = require('./routes/nafath.routes');
const contactFormRoutes = require('./routes/contactForm.routes');

const app = express();

app.use(helmet());
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://sitec-one.vercel.app'
  
];

app.use(
  cors({
    origin: function (origin, callback) {
      
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
// app.use('/api/listings', listingRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/cars', carRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/dev', devRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/site', siteRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/auth/nafath', nafathRoutes);
app.use('/api/contact-forms', contactFormRoutes);


module.exports = app;
