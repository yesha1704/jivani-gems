/* =============================================================================
 *  Cart module  (js/cart.js)  →  window.JVCart
 *  ---------------------------------------------------------------------------
 *  Source of truth = localStorage (so the cart persists across refreshes and
 *  works in DEMO MODE). When a user is logged in AND Supabase is live, every
 *  change is ALSO mirrored to the `cart` table so it follows them between
 *  devices (best-effort; the UI never blocks on the network).
 *
 *  Item shape:
 *    { product_id, variant_id, qty, snapshot:{ name, slug, image, price,
 *      category, metal, size, color } }
 *  key(item) = `${product_id}:${variant_id}`
 *
 *  Totals honour config: TAX_RATE (GST), SHIPPING_FLAT/FREE_SHIPPING_OVER and
 *  an applied voucher (VOUCHER_PERCENT).
 * ===========================================================================*/
(function () {
  const cfg = window.JIVANI_CONFIG || {};
  const LS_CART = 'jv_cart';
  const LS_VOUCHER = 'jv_voucher';

  const read  = () => { try { return JSON.parse(localStorage.getItem(LS_CART)) || []; } catch { return []; } };
  const write = (items) => { localStorage.setItem(LS_CART, JSON.stringify(items)); changed(); };
  const key   = (i) => `${i.product_id}:${i.variant_id || 'default'}`;

  function changed() {
    if (window.JV) JV.updateBadges();
    document.dispatchEvent(new CustomEvent('jv:cart-changed'));
    mirrorToServer();          // fire-and-forget
  }

  const JVCart = window.JVCart = {
    all: () => read(),
    count: () => read().reduce((n, i) => n + (i.qty || 1), 0),

    add(item, qty = 1) {
      const items = read();
      const k = key(item);
      const found = items.find(i => key(i) === k);
      if (found) found.qty += qty;
      else items.push(Object.assign({ qty }, item));
      write(items);
    },

    setQty(k, qty) {
      const items = read();
      const it = items.find(i => key(i) === k);
      if (!it) return;
      it.qty = Math.max(1, qty | 0);
      write(items);
    },

    remove(k) { write(read().filter(i => key(i) !== k)); },
    clear() { localStorage.removeItem(LS_CART); changed(); },
    key,

    /* ---- voucher (single-use 50% off) -------------------------------- */
    getVoucher: () => { try { return JSON.parse(localStorage.getItem(LS_VOUCHER)); } catch { return null; } },
    setVoucher(v) { if (v) localStorage.setItem(LS_VOUCHER, JSON.stringify(v)); else localStorage.removeItem(LS_VOUCHER); document.dispatchEvent(new CustomEvent('jv:cart-changed')); },

    // Soft client-side validation. The REAL, authoritative check happens server-
    // side in the Razorpay order/verify functions (a voucher can't be double-spent).
    async applyVoucher(code) {
      code = (code || '').trim().toUpperCase();
      if (!code) return { ok: false, message: 'Enter a voucher code.' };

      // DEMO MODE: accept a sample code so you can see the flow.
      if (window.JV_DEMO_MODE) {
        if (code === 'JIVANI50') { this.setVoucher({ code, percent: cfg.VOUCHER_PERCENT || 50 }); return { ok: true, message: 'Voucher applied — 50% off!' }; }
        return { ok: false, message: 'That code isn’t valid.' };
      }
      // LIVE: the code must match this user's unused voucher on their profile.
      try {
        const { data: { user } } = await window.sb.auth.getUser();
        if (!user) return { ok: false, message: 'Please log in to use a voucher.' };
        const { data: profile } = await window.sb.from('profiles').select('voucher_code, voucher_available').eq('id', user.id).single();
        if (profile && profile.voucher_available && profile.voucher_code && profile.voucher_code.toUpperCase() === code) {
          this.setVoucher({ code, percent: cfg.VOUCHER_PERCENT || 50 });
          return { ok: true, message: `Voucher applied — ${cfg.VOUCHER_PERCENT || 50}% off!` };
        }
        return { ok: false, message: 'That code isn’t valid or has already been used.' };
      } catch (e) {
        return { ok: false, message: 'Could not verify the voucher right now.' };
      }
    },

    /* ---- totals ------------------------------------------------------ */
    totals() {
      const items = read();
      const subtotal = items.reduce((s, i) => s + (i.snapshot?.price || 0) * (i.qty || 1), 0);
      const voucher = this.getVoucher();
      const discount = voucher ? Math.round(subtotal * (voucher.percent || 0) / 100) : 0;
      const taxable = Math.max(0, subtotal - discount);
      const tax = Math.round(taxable * (cfg.TAX_RATE || 0));
      const freeOver = cfg.FREE_SHIPPING_OVER || 0;
      const shipping = (freeOver === 0 || taxable >= freeOver) ? (cfg.SHIPPING_FLAT || 0) : (cfg.SHIPPING_FLAT || 0);
      const total = taxable + tax + shipping;
      return { subtotal, discount, voucher, taxable, tax, shipping, total };
    },

    /* ---- server mirror (best-effort) --------------------------------- */
    async syncFromServer() {
      if (window.JV_DEMO_MODE || !window.sb) return;
      try {
        const { data: { user } } = await window.sb.auth.getUser();
        if (!user) return;
        const { data } = await window.sb.from('cart').select('*').eq('user_id', user.id);
        if (data && data.length) {
          // merge server rows that aren't already local
          const items = read();
          data.forEach(row => {
            const item = { product_id: row.product_id, variant_id: row.variant_id, qty: row.qty, snapshot: row.snapshot };
            if (!items.find(i => key(i) === key(item))) items.push(item);
          });
          write(items);
        }
      } catch (_) { /* silent — cart still works locally */ }
    },
  };

  async function mirrorToServer() {
    if (window.JV_DEMO_MODE || !window.sb) return;
    try {
      const { data: { user } } = await window.sb.auth.getUser();
      if (!user) return;
      const items = read();
      // simplest reliable strategy: replace this user's cart rows with current state
      await window.sb.from('cart').delete().eq('user_id', user.id);
      if (items.length) {
        await window.sb.from('cart').insert(items.map(i => ({
          user_id: user.id, product_id: i.product_id, variant_id: i.variant_id, qty: i.qty, snapshot: i.snapshot,
        })));
      }
    } catch (_) { /* silent */ }
  }
})();
