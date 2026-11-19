require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./config/db');
const Transaction = require('./models/Transaction');
const webhookRoutes = require('./routes/webhookRoutes');
const { initiateSTKPush } = require('./services/mpesaService');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Webhook routes (Safaricom posts to /api/webhook/mpesa)
app.use('/api/webhook', webhookRoutes);

// Initiate payment
app.post('/api/pay', async (req, res) => {
  const { phone, amount, reference } = req.body;

  if (!phone || !amount) {
    return res.status(400).json({ error: 'phone and amount are required' });
  }

  try {
    const result = await initiateSTKPush(phone, amount, reference || 'ORDER');

    if (result.ResponseCode === '0') {
      // Persist PENDING transaction
      await Transaction.create({
        reference: reference || `REF-${Date.now()}`,
        phone,
        amount: Number(amount),
        accountReference: reference || 'ORDER',
        merchantRequestId: result.MerchantRequestID,
        checkoutRequestId: result.CheckoutRequestID,
        status: 'PENDING',
      });
    }

    res.json(result);
  } catch (error) {
    console.error('STK Push error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Payment initiation failed',
      details: error.response?.data || error.message,
    });
  }
});

// Status polling endpoint for the frontend
app.get('/api/status/:checkoutId', async (req, res) => {
  try {
    const tx = await Transaction.findOne(
      { checkoutRequestId: req.params.checkoutId },
      { status: 1, mpesaReceipt: 1, mpesaAmount: 1, mpesaPhone: 1, resultDesc: 1 }
    ).lean();

    if (!tx) return res.status(404).json({ status: 'UNKNOWN' });

    res.json({
      status: tx.status,
      receipt: tx.mpesaReceipt,
      amount: tx.mpesaAmount,
      phone: tx.mpesaPhone,
      resultDesc: tx.resultDesc,
    });
  } catch (err) {
    console.error('Status check error:', err.message);
    res.status(500).json({ error: 'Status check failed' });
  }
});

// Fallback to SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Boot
const PORT = process.env.PORT || 3000;
(async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📡 Callback URL: ${process.env.CALLBACK_URL}`);
  });
})();