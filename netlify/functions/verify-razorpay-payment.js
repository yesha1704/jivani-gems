/* =============================================================================
 *  POST /.netlify/functions/verify-razorpay-payment
 *  ---------------------------------------------------------------------------
 *  Called by the browser from the Razorpay Checkout success handler with:
 *    { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id }
 *
 *  We re-create the signature server-side with our KEY SECRET and compare. This
 *  is what proves the payment is real and untampered — never trust the browser.
 *  If valid, we confirm the order, award the next voucher, and email the receipt
 *  (shared logic in _shared.js, also used by the webhook as a backup).
 * ===========================================================================*/
const crypto = require('crypto');
const { admin, json, confirmOrderAndReward } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = JSON.parse(event.body || '{}');
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return json(400, { error: 'Missing payment fields' });

    // signature = HMAC_SHA256( "<order_id>|<payment_id>", KEY_SECRET )
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expected !== razorpay_signature) {
      console.error('[verify] signature mismatch for order', order_id);
      return json(400, { error: 'Payment verification failed' });
    }

    // valid → confirm (idempotent; the webhook may also fire)
    const db = admin();
    await confirmOrderAndReward(db, order_id, razorpay_payment_id);
    return json(200, { ok: true, order_id });
  } catch (err) {
    console.error('[verify-razorpay-payment]', err);
    return json(500, { error: 'Verification error' });
  }
};
