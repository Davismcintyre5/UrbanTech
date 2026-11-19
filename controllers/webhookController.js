const Transaction = require('../models/Transaction');

exports.handleMpesaCallback = async (req, res) => {
    try {
        const stk = req.body?.Body?.stkCallback;
        if (!stk) return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

        const tx = await Transaction.findOne({ checkoutRequestId: stk.CheckoutRequestID });
        if (!tx) return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

        if (stk.ResultCode === 0) {
            const metadata = stk.CallbackMetadata.Item;
            const getVal = (name) => metadata.find(i => i.Name === name)?.Value;

            await Transaction.findByIdAndUpdate(tx._id, {
                status: 'SUCCESS',
                mpesaReceipt: getVal('MpesaReceiptNumber'),
                rawCallback: req.body
            });
            console.log(`✅ Urban Tech Payment SUCCESS: ${getVal('MpesaReceiptNumber')}`);
        } else {
            const status = stk.ResultCode === 1032 ? 'CANCELLED' : 'FAILED';
            await Transaction.findByIdAndUpdate(tx._id, {
                status,
                resultCode: stk.ResultCode,
                resultDesc: stk.ResultDesc,
                rawCallback: req.body
            });
            console.log(`❌ Urban Tech Payment ${status}: ${stk.ResultDesc}`);
        }
        res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
};