require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const connectDB = require('./config/db');
const startKeepAlive = require('./config/keepAlive');
const Transaction = require('./models/Transaction');
const webhookRoutes = require('./routes/webhookRoutes');
const { initiateSTKPush } = require('./services/mpesaService');

// Middleware imports
const logger = require('./middleware/logger');
const botProtection = require('./middleware/botProtection');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// 1. Security & Parsing
app.use(helmet({
    contentSecurityPolicy: false, // Allowed for inline scripts in index.html
}));
app.use(express.json());
app.use(logger);

// 2. Database
connectDB();

// 3. Health Check Endpoint (Public, bypasses bot protection)
// Responds instantly to the Keep-Alive pings
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'UP', 
        service: 'Urban Tech API',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// 4. Webhook (Must bypass bot protection for Safaricom servers)
app.use('/api/webhook', webhookRoutes);

// 5. Static Files & Protected Routes
app.use(express.static(path.join(__dirname, 'public')));
app.use(botProtection); // Apply bot protection to all remaining API routes

// Payment Initiation
app.post('/api/pay', async (req, res, next) => {
    const { phone, amount, reference } = req.body;
    if (!phone || !amount) return res.status(400).json({ error: 'Phone and amount required' });

    try {
        const result = await initiateSTKPush(phone, amount, reference);
        
        if (result.ResponseCode === '0') {
            await Transaction.create({
                reference: reference || `UT-${Date.now()}`,
                phone,
                amount: Number(amount),
                checkoutRequestId: result.CheckoutRequestID,
                status: 'PENDING'
            });
        }
        res.json(result);
    } catch (error) {
        next(error); 
    }
});

// Payment Status Polling
app.get('/api/status/:checkoutId', async (req, res, next) => {
    try {
        const tx = await Transaction.findOne({ checkoutRequestId: req.params.checkoutId });
        if (!tx) return res.status(404).json({ status: 'UNKNOWN' });
        res.json({ status: tx.status, receipt: tx.mpesaReceipt, resultDesc: tx.resultDesc });
    } catch (error) {
        next(error);
    }
});

// 6. Frontend Fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// 7. Global Error Handler (Must be last)
app.use(errorHandler);

// 8. Boot Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Urban Tech Server running on port ${PORT}`);
    // Start the Keep-Alive pings
    startKeepAlive();
});