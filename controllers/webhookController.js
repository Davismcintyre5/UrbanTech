const Transaction = require('../models/Transaction');

exports.handleMpesaCallback = async (req, res) => {
  try {
    const callbackData = req.body;
    console.log('M-Pesa Callback Received:', JSON.stringify(callbackData, null, 2));

    const stk = callbackData?.Body?.stkCallback;
    if (!stk?.CheckoutRequestID) {
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const checkoutRequestId = stk.CheckoutRequestID;

    // Find the pending transaction (created at /api/pay time)
    const tx = await Transaction.findOne({ checkoutRequestId });
    if (!tx) {
      console.warn(`⚠️ No transaction found for ${checkoutRequestId}`);
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    if (stk.ResultCode === 0) {
      const metadata = stk.CallbackMetadata.Item;
      const getItem = (name) => metadata.find((i) => i.Name === name)?.Value;

      const payload = {
        mpesaReceipt: getItem('MpesaReceiptNumber'),
        amount: getItem('Amount'),
        phone: getItem('PhoneNumber'),
        transactionDate: getItem('TransactionDate'),
        resultDesc: stk.ResultDesc,
        rawCallback: callbackData,
      };

      const updated = await Transaction.markSuccess(checkoutRequestId, payload);

      if (updated) {
        console.log(`✅ SUCCESS: ${payload.mpesaReceipt} · KES ${payload.amount} · ${payload.phone}`);
        // TODO: fulfil the order, e.g. emit socket event, send SMS, ship goods
      } else {
        // Already processed — idempotent no-op
        console.log(`ℹ️ Duplicate callback ignored for ${checkoutRequestId}`);
      }
    } else {
      // Failed or cancelled by user
      const status = stk.ResultCode === 1032 ? 'CANCELLED' : 'FAILED';
      await Transaction.markFailed(checkoutRequestId, {
        status,
        resultCode: stk.ResultCode,
        resultDesc: stk.ResultDesc,
        rawCallback: callbackData,
      });
      console.log(`❌ ${status}: ${stk.ResultDesc}`);
    }

    // Always 200 to prevent Safaricom retries
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    console.error('Webhook Processing Error:', error);
    // Still return 200 so Safaricom doesn't hammer you — log the failure instead
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
};