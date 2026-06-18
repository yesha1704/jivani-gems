/* =============================================================================
 *  POST /.netlify/functions/create-razorpay-order
 *  ---------------------------------------------------------------------------
 *  Body: { user_id, email, items:[{product_id,variant_id,qty,snapshot}],
 *          shipping_address, voucher_code }
 *
 *  SECURITY: prices are RE-COMPUTED from the database here — the client's
 *  snapshot prices are never trusted. The voucher is validated against the
 *  user's profile server-side so it can't be forged or double-spent.
 *
 *  Creates a PENDING order row + a Razorpay Order, and returns what the
 *  front-end needs to open the Razorpay Checkout widget. After payment, the
 *  front-end calls verify-razorpay-payment (and razorpay-webhook is a backup)
 *  which flips the order to confirmed, awards the next voucher, and emails the
 *  receipt.
 * ===========================================================================*/
const Razorpay = require('razorpay');
const { CFG, admin, json } = require('./_shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  const db = admin();

  try {
    const { user_id, email, items, shipping_address, voucher_code } = JSON.parse(event.body || '{}');
    if (!items || !items.length) return json(400, { error: 'Cart is empty' });

    // ---- 1. Re-price from the DB (don't trust the client) ----
    const variantIds = items.map(i => i.variant_id).filter(Boolean);
    const productIds = items.map(i => i.product_id).filter(Boolean);
    const [{ data: variants }, { data: products }] = await Promise.all([
      variantIds.length ? db.from('product_variants').select('id, price, product_id').in('id', variantIds) : Promise.resolve({ data: [] }),
      db.from('products').select('id, name, base_price, images').in('id', productIds),
    ]);
    const vMap = Object.fromEntries((variants || []).map(v => [v.id, v]));
    const pMap = Object.fromEntries((products || []).map(p => [p.id, p]));

    const priced = items.map(i => {
      const prod = pMap[i.product_id] || {};
      const unit = (i.variant_id && vMap[i.variant_id]) ? Number(vMap[i.variant_id].price) : Number(prod.base_price || 0);
      const img = (prod.images && prod.images[0]) || (i.snapshot && /^https?:\/\//.test(i.snapshot.image) ? i.snapshot.image : null);
      return { product_id: i.product_id, variant_id: i.variant_id || null, qty: Math.max(1, parseInt(i.qty) || 1),
        name: prod.name || i.snapshot?.name || 'Jivani Gems piece', price: unit, image: img };
    });

    const subtotal = priced.reduce((s, i) => s + i.price * i.qty, 0);
    if (subtotal <= 0) return json(400, { error: 'Could not price the cart' });

    // ---- 2. Validate the voucher against the profile ----
    let discount = 0, voucherUsed = null;
    if (voucher_code && user_id) {
      const { data: profile } = await db.from('profiles').select('voucher_code, voucher_available').eq('id', user_id).single();
      if (profile && profile.voucher_available && profile.voucher_code &&
          profile.voucher_code.toUpperCase() === String(voucher_code).toUpperCase()) {
        discount = Math.round(subtotal * (CFG.VOUCHER_PERCENT / 100));
        voucherUsed = profile.voucher_code;
      }
    }

    const taxable = Math.max(0, subtotal - discount);
    const tax = Math.round(taxable * CFG.TAX_RATE);
    const shipping = (CFG.FREE_SHIPPING_OVER === 0 || taxable >= CFG.FREE_SHIPPING_OVER) ? CFG.SHIPPING_FLAT : CFG.SHIPPING_FLAT;
    const total = taxable + tax + shipping;
    const amountPaise = Math.round(total * 100);   // Razorpay works in the smallest unit

    // ---- 3. Create the Razorpay order ----
    const rzpOrder = await rzp.orders.create({
      amount: amountPaise,
      currency: CFG.CURRENCY,                       // 'INR'
      receipt: 'jv_' + Date.now(),                  // ≤ 40 chars
      notes: { user_id: user_id || '', voucher: voucherUsed || '' },
    });

    // ---- 4. Insert a PENDING order (store the Razorpay order id to reconcile) ----
    const { data: order, error: oErr } = await db.from('orders').insert({
      user_id: user_id || null,
      items: priced.map(i => ({ name: i.name, qty: i.qty, price: i.price, image: i.image, product_id: i.product_id, variant_id: i.variant_id })),
      subtotal, tax, shipping, discount, total,
      shipping_address, status: 'pending', voucher_code_used: voucherUsed,
      razorpay_order_id: rzpOrder.id,
    }).select('id').single();
    if (oErr) throw oErr;

    // ---- 5. Hand the widget config back to the browser ----
    return json(200, {
      key_id: process.env.RAZORPAY_KEY_ID,
      amount: amountPaise,
      currency: CFG.CURRENCY,
      razorpay_order_id: rzpOrder.id,
      order_id: order.id,
    });
  } catch (err) {
    console.error('[create-razorpay-order]', err);
    return json(500, { error: 'Could not start checkout' });
  }
};
