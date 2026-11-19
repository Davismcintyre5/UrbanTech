const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    reference: { type: String, required: true, index: true },
    phone: { type: String, required: true },
    amount: { type: Number, required: true },
    checkoutRequestId: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'], default: 'PENDING' },
    mpesaReceipt: { type: String, sparse: true, unique: true },
    resultCode: Number,
    resultDesc: String,
    rawCallback: mongoose.Schema.Types.Mixed
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);