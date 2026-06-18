/* =============================================================================
 *  Checkout module  (js/checkout.js)  →  powers checkout.html
 *  ---------------------------------------------------------------------------
 *  Flow: review items → confirm shipping address → apply voucher → see GST +
 *  shipping → pay.
 *    • LIVE  : POSTs the cart to /.netlify/functions/create-razorpay-order, then
 *              opens the Razorpay Checkout widget (popup). On success Razorpay
 *              returns a payment id + signature, which we POST to
 *              /.netlify/functions/verify-razorpay-payment. That server step
 *              confirms the order, awards the voucher and emails the receipt
 *              (razorpay-webhook.js is a backup if the tab closes early).
 *    • DEMO  : simulates a successful order locally (localStorage), awards the
 *              voucher to the demo profile, clears the cart, and forwards to the
 *              success page — so you can click the whole flow with no backend.
 *
 *  Requires the Razorpay Checkout script (loaded in checkout.html):
 *    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
 * ===========================================================================*/
(function () {
  if (document.body.dataset.page !== 'checkout') return;
  const cfg = window.JIVANI_CONFIG || {};

  // order date + N business days (skips Sat/Sun)
  function addBusinessDays(date, n) {
    const d = new Date(date); let added = 0;
    while (added < n) { d.setDate(d.getDate() + 1); const wd = d.getDay(); if (wd !== 0 && wd !== 6) added++; }
    return d;
  }

  function renderSummary() {
    const items = JVCart.all();
    const t = JVCart.totals();
    JV.qs('#co-items').innerHTML = items.map(i => {
      const s = i.snapshot || {};
      return `<div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid var(--line)">
        <img src="${s.image||''}" alt="" style="width:54px;height:68px;object-fit:cover;background:#EEF0F4">
        <div style="flex:1">
          <div class="serif" style="font-size:17px">${s.name||'Piece'}</div>
          <div class="muted" style="font-size:12px">Qty ${i.qty}${s.metal?' · '+JV.metalLabel(s.metal):''}</div>
        </div>
        <div class="serif" style="font-size:16px;white-space:nowrap">${JV.money((s.price||0)*i.qty)}</div>
      </div>`;
    }).join('');

    JV.qs('#co-totals').innerHTML = `
      <div class="jv-summary-row"><span>Subtotal</span><span>${JV.money(t.subtotal)}</span></div>
      ${t.discount ? `<div class="jv-summary-row" style="color:var(--success)"><span>Voucher (${t.voucher.percent}% off)</span><span>− ${JV.money(t.discount)}</span></div>` : ''}
      <div class="jv-summary-row"><span>${cfg.TAX_LABEL||'Tax'}</span><span>${JV.money(t.tax)}</span></div>
      <div class="jv-summary-row"><span>Shipping</span><span>${t.shipping ? JV.money(t.shipping) : 'Complimentary'}</span></div>
      <div class="jv-summary-row total"><span>Total</span><span>${JV.money(t.total)}</span></div>`;
  }

  async function prefillAddress() {
    const p = await JVAuth.currentProfile();
    if (!p) return;
    const set = (id, v) => { const e = JV.qs('#' + id); if (e && v) e.value = v; };
    set('co-name', p.full_name); set('co-phone', p.phone); set('co-address', p.address);
    set('co-city', p.city); set('co-state', p.state); set('co-pincode', p.pincode);
    set('co-email', p.email);
  }

  function readAddress() {
    return {
      full_name: JV.qs('#co-name').value.trim(), phone: JV.qs('#co-phone').value.trim(),
      email: JV.qs('#co-email').value.trim(), address: JV.qs('#co-address').value.trim(),
      city: JV.qs('#co-city').value.trim(), state: JV.qs('#co-state').value.trim(), pincode: JV.qs('#co-pincode').value.trim(),
    };
  }
  function addressValid(a) { return a.full_name && a.phone && a.address && a.city && a.state && a.pincode && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email); }

  const payBtn = () => JV.qs('#co-pay');
  function setBusy(on) { const b = payBtn(); b.disabled = on; b.innerHTML = on ? '<span class="jv-spinner" style="border-color:rgba(255,255,255,.4);border-top-color:#fff"></span>' : 'Pay securely'; }

  /* --------------------------- pay -------------------------------------- */
  async function pay() {
    const items = JVCart.all();
    if (!items.length) { JV.toast('Your cart is empty.', 'error'); return; }
    const addr = readAddress();
    if (!addressValid(addr)) { JV.toast('Please complete all shipping fields.', 'error'); return; }

    setBusy(true);

    // persist address back to the profile for next time (best-effort)
    JVAuth.updateProfile({ full_name: addr.full_name, phone: addr.phone, address: addr.address, city: addr.city, state: addr.state, pincode: addr.pincode });

    const t = JVCart.totals();

    /* ---- DEMO: simulate a confirmed order locally ---- */
    if (window.JV_DEMO_MODE) {
      const order = {
        id: 'JV' + Date.now(), created_at: new Date().toISOString(),
        items: items.map(i => ({ name: i.snapshot?.name, qty: i.qty, price: i.snapshot?.price, image: i.snapshot?.image })),
        subtotal: t.subtotal, tax: t.tax, shipping: t.shipping, discount: t.discount, total: t.total,
        shipping_address: addr, status: 'confirmed',
        expected_delivery: addBusinessDays(new Date(), cfg.DELIVERY_BUSINESS_DAYS || 7).toISOString(),
        tracking_number: 'TRK' + Math.floor(Math.random() * 1e7),
      };
      const orders = JSON.parse(localStorage.getItem('jv_orders') || '[]'); orders.unshift(order);
      localStorage.setItem('jv_orders', JSON.stringify(orders));

      // award a fresh single-use 50% voucher to the (demo) profile
      const code = 'JIVANI' + (cfg.VOUCHER_PERCENT||50) + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
      const demo = JSON.parse(localStorage.getItem('jv_demo_user') || 'null');
      if (demo) { demo.voucher_available = true; demo.voucher_code = code; localStorage.setItem('jv_demo_user', JSON.stringify(demo)); }

      JVCart.setVoucher(null); JVCart.clear();
      location.href = `order-success.html?order=${order.id}`;
      return;
    }

    /* ---- LIVE: Razorpay Checkout ---- */
    try {
      if (typeof Razorpay === 'undefined') throw new Error('Razorpay script not loaded');
      const { data: { user } } = await window.sb.auth.getUser();

      // 1) create the Razorpay order + pending DB order on the server
      const res = await fetch('/.netlify/functions/create-razorpay-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, email: addr.email, items, shipping_address: addr, voucher_code: JVCart.getVoucher()?.code || null }),
      });
      if (!res.ok) throw new Error('order create failed');
      const data = await res.json();   // { key_id, amount, currency, razorpay_order_id, order_id }
      if (!data.razorpay_order_id) throw new Error('no razorpay order');

      // 2) open the Razorpay widget
      const rzp = new Razorpay({
        key: data.key_id || cfg.RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: data.currency,
        order_id: data.razorpay_order_id,
        name: cfg.SITE_NAME || 'Jivani Gems',
        description: 'Lab-grown diamond jewelry',
        image: (cfg.SITE_URL || '') + '/assets/og-image.jpg',   // optional logo
        prefill: { name: addr.full_name, email: addr.email, contact: addr.phone },
        notes: { order_id: data.order_id },
        theme: { color: '#0F1B3D' },
        // 3) on success → verify the signature server-side
        handler: async (resp) => {
          try {
            const v = await fetch('/.netlify/functions/verify-razorpay-payment', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
                order_id: data.order_id,
              }),
            });
            if (!v.ok) throw new Error('verify failed');
            JVCart.setVoucher(null); JVCart.clear();
            location.href = `order-success.html?order=${data.order_id}`;
          } catch (e) {
            setBusy(false);
            JV.toast('Payment captured but verification failed. If you were charged, contact us — we’ll sort it out.', 'error', 7000);
          }
        },
        modal: { ondismiss: () => setBusy(false) },   // user closed the popup
      });
      rzp.on('payment.failed', () => { setBusy(false); JV.toast('Payment failed. Please try again.', 'error'); });
      rzp.open();
    } catch (e) {
      setBusy(false);
      JV.toast('We couldn’t start checkout. Please try again.', 'error');
    }
  }

  /* --------------------------- boot ------------------------------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    if (!JVCart.all().length) { JV.qs('#checkout-stage').innerHTML = `<div class="jv-empty"><div class="mark"></div><h3>Nothing to check out</h3><p>Your cart is empty.</p><a class="jv-btn jv-btn-sm" href="shop.html">Browse pieces</a></div>`; return; }
    renderSummary();
    prefillAddress();

    JV.qs('#co-apply').addEventListener('click', async () => {
      const code = JV.qs('#co-voucher').value;
      const r = await JVCart.applyVoucher(code);
      JV.toast(r.message, r.ok ? 'success' : 'error');
      if (r.ok) renderSummary();
    });
    document.addEventListener('jv:cart-changed', renderSummary);
    JV.qs('#co-pay').addEventListener('click', pay);
  });
})();
