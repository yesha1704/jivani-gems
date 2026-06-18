/* =============================================================================
 *  Shared helpers for Netlify functions  (netlify/functions/_shared.js)
 *  ---------------------------------------------------------------------------
 *  Filename starts with "_" so Netlify does NOT expose it as an endpoint.
 *  Holds: env-driven config, a service-role Supabase client (server-only),
 *  the Resend client, money/date helpers, and the HTML email templates.
 *
 *  SECRETS are read from environment variables (set in Netlify dashboard /
 *  local .env) — never hardcoded. See .env.example.
 * ===========================================================================*/
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

// ---- config (mirror js/config.js where it matters) ----
const CFG = {
  CURRENCY: process.env.CURRENCY || 'INR',
  CURRENCY_SYMBOL: process.env.CURRENCY_SYMBOL || '₹',
  LOCALE: process.env.LOCALE || 'en-IN',
  TAX_RATE: parseFloat(process.env.TAX_RATE || '0.18'),
  TAX_LABEL: process.env.TAX_LABEL || 'GST (18%)',
  SHIPPING_FLAT: parseFloat(process.env.SHIPPING_FLAT || '0'),
  FREE_SHIPPING_OVER: parseFloat(process.env.FREE_SHIPPING_OVER || '0'),
  VOUCHER_PERCENT: parseInt(process.env.VOUCHER_PERCENT || '50'),
  DELIVERY_BUSINESS_DAYS: parseInt(process.env.DELIVERY_BUSINESS_DAYS || '7'),
  SITE_URL: (process.env.SITE_URL || 'http://localhost:8888').replace(/\/$/, ''),
  FROM: process.env.ORDER_FROM_EMAIL || 'Jivani Gems <onboarding@resend.dev>',
};

// ---- service-role Supabase client (bypasses RLS — server only!) ----
function admin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

const resend = () => new Resend(process.env.RESEND_API_KEY);

// ---- helpers ----
const money = (n) => {
  try { return new Intl.NumberFormat(CFG.LOCALE, { style: 'currency', currency: CFG.CURRENCY, maximumFractionDigits: 0 }).format(Number(n) || 0); }
  catch { return CFG.CURRENCY_SYMBOL + Math.round(Number(n) || 0).toLocaleString(); }
};

function addBusinessDays(date, n) {
  const d = new Date(date); let added = 0;
  while (added < n) { d.setDate(d.getDate() + 1); const wd = d.getDay(); if (wd !== 0 && wd !== 6) added++; }
  return d;
}
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString(CFG.LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return String(d); } }
const newVoucherCode = () => `JIVANI${CFG.VOUCHER_PERCENT}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/* ----------------------------- email shell ------------------------------ */
function shell(title, inner) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#FAFAF7;font-family:Helvetica,Arial,sans-serif;color:#0F1B3D">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px">
      <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #ECEEF2">
        <div style="font-family:Georgia,serif;font-size:26px;letter-spacing:6px">JIVANI&nbsp;GEMS</div>
        <div style="font-size:9px;letter-spacing:5px;color:#A8B4CE;margin-top:6px">LAB-GROWN · CERTIFIED · ETERNAL</div>
      </div>
      <div style="padding:32px 0">${inner}</div>
      <div style="border-top:1px solid #ECEEF2;padding-top:20px;font-size:11px;color:#6B7385;text-align:center">
        © ${new Date().getFullYear()} Jivani Gems · All diamonds IGI &amp; GIA certified.<br>
        <a href="${CFG.SITE_URL}" style="color:#6B7385">${CFG.SITE_URL.replace(/^https?:\/\//,'')}</a>
      </div>
    </div></body></html>`;
}
const h1 = (t) => `<h1 style="font-family:Georgia,serif;font-weight:400;font-size:30px;margin:0 0 14px">${t}</h1>`;
const p = (t) => `<p style="font-size:15px;line-height:1.7;color:#4A5263;margin:0 0 16px">${t}</p>`;
const btn = (href, label) => `<a href="${href}" style="display:inline-block;background:#0F1B3D;color:#FAFAF7;text-decoration:none;padding:15px 30px;font-size:11px;letter-spacing:3px;text-transform:uppercase">${label}</a>`;

/* ----------------------------- templates -------------------------------- */
const tplWelcome = (name) => shell('Welcome', `
  ${h1(`Welcome${name ? ', ' + name : ''}.`)}
  ${p('Your account has been created successfully — click below to start shopping and buy your dream jewelry today.')}
  <div style="margin:24px 0">${btn(CFG.SITE_URL + '/shop.html', 'Start shopping')}</div>
  ${p('A special reward awaits after your first order. ✦')}`);

const tplCustomOrder = (d) => shell('Custom order received', `
  ${h1('We’ve received your request.')}
  ${p('Thank you — we’ve received your custom order request and will reach out within <strong>3 business days</strong> with a quote.')}
  <table style="width:100%;font-size:14px;color:#4A5263;border-collapse:collapse">
    ${[['Type', d.jewelry_type], ['Metal', d.gold_type], ['Carat', d.carat], ['Diamonds', d.num_diamonds], ['Shape', d.diamond_type], ['Colour', d.color]]
      .filter(([, v]) => v != null && v !== '').map(([k, v]) => `<tr><td style="padding:6px 0;color:#6B7385">${k}</td><td style="text-align:right">${v}</td></tr>`).join('')}
  </table>
  ${d.shape_description ? p('<em>“' + d.shape_description + '”</em>') : ''}`);

const tplContact = (d) => shell('Message received', `
  ${h1('Thanks for reaching out.')}
  ${p(`Hi ${d.name || 'there'}, we’ve received your message and will reply within one business day.`)}
  ${p('<strong>Your message:</strong><br>' + (d.message || '').replace(/</g, '&lt;'))}`);

function tplOrder(order) {
  const rows = (order.items || []).map(i => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #ECEEF2">
        ${i.image ? `<img src="${i.image}" width="44" style="vertical-align:middle;border-radius:2px;margin-right:10px">` : ''}
        ${i.name} ${i.qty > 1 ? '× ' + i.qty : ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #ECEEF2;text-align:right">${money((i.price || 0) * (i.qty || 1))}</td>
    </tr>`).join('');
  const a = order.shipping_address || {};
  const line = (label, val) => `<tr><td style="padding:4px 0;color:#6B7385">${label}</td><td style="text-align:right">${val}</td></tr>`;
  return shell('Order confirmed', `
    ${h1('Thank you — your order is confirmed.')}
    ${p(`Order <strong>#${String(order.id).slice(0, 8).toUpperCase()}</strong> · placed ${fmtDate(order.created_at || new Date())}`)}
    <table style="width:100%;font-size:14px;border-collapse:collapse">${rows}</table>
    <table style="width:100%;font-size:14px;margin-top:14px">
      ${line('Subtotal', money(order.subtotal))}
      ${order.discount ? line('Voucher', '− ' + money(order.discount)) : ''}
      ${line(CFG.TAX_LABEL, money(order.tax))}
      ${line('Shipping', order.shipping ? money(order.shipping) : 'Complimentary')}
      <tr><td style="padding:10px 0;font-family:Georgia,serif;font-size:20px;border-top:1px solid #ECEEF2">Total</td>
          <td style="padding:10px 0;font-family:Georgia,serif;font-size:20px;text-align:right;border-top:1px solid #ECEEF2">${money(order.total)}</td></tr>
    </table>
    <div style="margin:24px 0;padding:18px;background:#fff;border:1px solid #ECEEF2">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B7385;margin-bottom:8px">Shipping to</div>
      <div style="font-size:14px;line-height:1.6">${a.full_name || ''}<br>${a.address || ''}<br>${[a.city, a.state, a.pincode].filter(Boolean).join(', ')}</div>
      <div style="margin-top:10px;font-size:13px;color:#4A5263">Estimated delivery: <strong>${fmtDate(order.expected_delivery)}</strong></div>
    </div>
    <div style="margin:24px 0">${btn(CFG.SITE_URL + '/account.html', 'Track your order')}</div>
    ${order.voucher_reward ? `<div style="padding:18px;border:1px dashed #0F1B3D;text-align:center">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B7385">A reward, unlocked</div>
        <div style="font-family:Georgia,serif;font-size:22px;margin:6px 0">You’ve earned a ${CFG.VOUCHER_PERCENT}% off voucher!</div>
        <div style="font-size:13px;color:#4A5263">Find the code in your account — apply it on your next order.</div>
      </div>` : ''}`);
}

/* ----------------------- confirm order + voucher ------------------------ */
// Shared by verify-razorpay-payment.js (immediate, after the widget succeeds)
// AND razorpay-webhook.js (backup, server-to-server). Idempotent: if the order
// is already confirmed it does nothing, so it's safe to run twice.
//   1. flips the pending order → confirmed (+ tracking + delivery date + payment id)
//   2. consumes the used voucher (if any) and awards a fresh 50% voucher for the
//      NEXT order  → the repeating voucher loop
//   3. emails the itemized confirmation (with the voucher reveal)
async function confirmOrderAndReward(db, orderId, paymentId) {
  const { data: order } = await db.from('orders').select('*').eq('id', orderId).single();
  if (!order) { console.error('[confirmOrder] order not found', orderId); return { changed: false }; }
  if (order.status !== 'pending') return { changed: false, already: true };  // idempotent

  const expected = addBusinessDays(new Date(), CFG.DELIVERY_BUSINESS_DAYS).toISOString().slice(0, 10);
  const tracking = 'TRK' + Math.floor(Math.random() * 1e8);
  await db.from('orders').update({
    status: 'confirmed', expected_delivery: expected, tracking_number: tracking, razorpay_payment_id: paymentId,
  }).eq('id', orderId);

  // voucher loop
  let voucherReward = false;
  if (order.user_id) {
    const { data: profile } = await db.from('profiles').select('voucher_available, voucher_code').eq('id', order.user_id).single();
    const consumed = !!order.voucher_code_used;            // a voucher was spent on this order
    const award = consumed || !(profile && profile.voucher_available);
    if (award) {
      await db.from('profiles').update({ voucher_available: true, voucher_code: newVoucherCode() }).eq('id', order.user_id);
      voucherReward = true;
    }
  }

  // confirmation email
  const to = (order.shipping_address && order.shipping_address.email) || order.contact_email;
  if (to && process.env.RESEND_API_KEY) {
    try {
      await resend().emails.send({
        from: CFG.FROM, to,
        subject: `Your Jivani Gems order #${String(order.id).slice(0, 8).toUpperCase()} is confirmed`,
        html: tplOrder({ ...order, expected_delivery: expected, tracking_number: tracking, voucher_reward: voucherReward }),
      });
    } catch (e) { console.error('[confirmOrder] email failed (non-fatal):', e.message); }
  }
  return { changed: true, voucherReward };
}

module.exports = { CFG, admin, resend, money, addBusinessDays, fmtDate, newVoucherCode, json,
  tplWelcome, tplCustomOrder, tplContact, tplOrder, confirmOrderAndReward };
