/* =============================================================================
 *  Wishlist module  (js/wishlist.js)  →  window.JVWishlist
 *  ---------------------------------------------------------------------------
 *  Same pattern as the cart: localStorage primary (persists across refreshes,
 *  works in DEMO MODE) with best-effort mirroring to the `wishlist` table when
 *  a user is logged in on a live Supabase project.
 *
 *  Item shape:
 *    { product_id, variant_id, snapshot:{ name, slug, image, price, category } }
 * ===========================================================================*/
(function () {
  const LS = 'jv_wishlist';
  const read  = () => { try { return JSON.parse(localStorage.getItem(LS)) || []; } catch { return []; } };
  const write = (items) => { localStorage.setItem(LS, JSON.stringify(items)); changed(); };
  const key   = (i) => `${i.product_id}:${i.variant_id || 'default'}`;

  function changed() {
    if (window.JV) JV.updateBadges();
    document.dispatchEvent(new CustomEvent('jv:wishlist-changed'));
    mirror();
  }

  const JVWishlist = window.JVWishlist = {
    all: () => read(),
    count: () => read().length,
    key,
    has: (product_id, variant_id) => read().some(i => key(i) === `${product_id}:${variant_id || 'default'}`),

    toggle(item) {
      const items = read();
      const k = key(item);
      const idx = items.findIndex(i => key(i) === k);
      if (idx >= 0) { items.splice(idx, 1); write(items); return false; }   // removed
      items.push(item); write(items); return true;                          // added
    },

    add(item) { if (!this.has(item.product_id, item.variant_id)) write([...read(), item]); },
    remove(k) { write(read().filter(i => key(i) !== k)); },
    clear() { localStorage.removeItem(LS); changed(); },

    // Move a wishlist item into the cart (used by the wishlist page).
    moveToCart(k) {
      const it = read().find(i => key(i) === k);
      if (!it || !window.JVCart) return;
      JVCart.add({ product_id: it.product_id, variant_id: it.variant_id, snapshot: it.snapshot }, 1);
      this.remove(k);
    },

    async syncFromServer() {
      if (window.JV_DEMO_MODE || !window.sb) return;
      try {
        const { data: { user } } = await window.sb.auth.getUser();
        if (!user) return;
        const { data } = await window.sb.from('wishlist').select('*, products(name, slug, images, base_price, category)').eq('user_id', user.id);
        if (data && data.length) {
          const items = read();
          data.forEach(row => {
            const p = row.products || {};
            const item = { product_id: row.product_id, variant_id: row.variant_id,
              snapshot: { name: p.name, slug: p.slug, image: (p.images || [])[0], price: p.base_price, category: p.category } };
            if (!items.find(i => key(i) === key(item))) items.push(item);
          });
          write(items);
        }
      } catch (_) {}
    },
  };

  async function mirror() {
    if (window.JV_DEMO_MODE || !window.sb) return;
    try {
      const { data: { user } } = await window.sb.auth.getUser();
      if (!user) return;
      const items = read();
      await window.sb.from('wishlist').delete().eq('user_id', user.id);
      if (items.length) {
        await window.sb.from('wishlist').insert(items.map(i => ({
          user_id: user.id, product_id: i.product_id, variant_id: i.variant_id,
        })));
      }
    } catch (_) {}
  }
})();
