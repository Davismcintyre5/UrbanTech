const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    // Merchant / request context
    reference: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 1 },
    accountReference: { type: String, default: 'ORDER' },

    // Daraja identifiers
    merchantRequestId: { type: String, index: true },
    checkoutRequestId: { type: String, required: true, unique: true, index: true },

    // Lifecycle
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },

    // Success payload
    mpesaReceipt: { type: String, sparse: true, unique: true },
    mpesaAmount: Number,
    mpesaPhone: String,
    transactionDate: Date,

    // Failure payload
    resultCode: Number,
    resultDesc: String,

    // Audit
    rawCallback: { type: mongoose.Schema.Types.Mixed },
    callbackReceivedAt: Date,
  },
  { timestamps: true }
);

// Compound index for common queries
transactionSchema.index({ phone: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });

// Helper: mark as paid (idempotent)
transactionSchema.statics.markSuccess = async function (checkoutRequestId, payload) {
  return this.findOneAndUpdate(
    { checkoutRequestId, status: { $ne: 'SUCCESS' } },
    {
      $set: {
        status: 'SUCCESS',
        mpesaReceipt: payload.mpesaReceipt,
        mpesaAmount: payload.amount,
        mpesaPhone: payload.phone,
        transactionDate: payload.transactionDate,
        resultCode: 0,
        resultDesc: payload.resultDesc || 'Success',
        rawCallback: payload.rawCallback,
        callbackReceivedAt: new Date(),
      },
    },
    { new: true }
  );
};

transactionSchema.statics.markFailed = async function (checkoutRequestId, payload) {
  return this.findOneAndUpdate(
    { checkoutRequestId, status: 'PENDING' },
    {
      $set: {
        status: payload.status || 'FAILED',
        resultCode: payload.resultCode,
        resultDesc: payload.resultDesc,
        rawCallback: payload.rawCallback,
        callbackReceivedAt: new Date(),
      },
    },
    { new: true }
  );
};

module.exports = mongoose.model('Transaction', transactionSchema);