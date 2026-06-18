/* =============================================================================
 *  POST /.netlify/functions/razorpay-webhook   (Razorpay → us)
 *  ---------------------------------------------------------------------------
 *  A BACKUP to the front-end verify step: if the buyer closes the tab right
 *  after paying (before the success handler runs), Razorpay still tells us
 *  here, so the order is confirmed, the voucher awarded, and the receipt sent.
 *
 *  Verifies the webhook signature with RAZORPAY_WEBHOOK_SECRET, then on
 *  `payment.captured` / `order.paid` confirms the matching order. confirmOrder
 *  is idempotent, so running after the verify step is harmless.
 *
 *  Set the webhook + its secret in the Razorpay dashboard — SETUP-GUIDE Step 3.
 * ===========================================================================*/
const crypto = require('crypto');
const { admin, json, confirmOrderAndReward } = require('./_shared');

exports.handler = async (event) => {
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  const signature = event.headers['x-razorpay-signature'] || event.headers['X-Razorpay-Signature'];

  // verify the payload signature
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '').update(raw).digest('hex');
  if (!signature || expected !== signature) {
    console.error('[razorpay-webhook] signature verification failed');
    return { statusCode: 400, body: 'Invalid signature' };
  }

  try {
    const payload = JSON.parse(raw);
    if (payload.event === 'payment.captured' || payload.event === 'order.paid') {
      const paymentEntity = payload.payload?.payment?.entity;
      const orderEntity = payload.payload?.order?.entity;
      const rzpOrderId = (paymentEntity && paymentEntity.order_id) || (orderEntity && orderEntity.id);
      const paymentId = paymentEntity && paymentEntity.id;

      if (rzpOrderId) {
        const db = admin();
        const { data: order } = await db.from('orders').select('id').eq('razorpay_order_id', rzpOrderId).single();
        if (order) await confirmOrderAndReward(db, order.id, paymentId || null);
      }
    }
    return json(200, { received: true });
  } catch (err) {
    console.error('[razorpay-webhook] handler error:', err);
    return json(200, { received: true, error: true });   // 200 so Razorpay doesn't retry-storm on our bug
  }
};
