/* =============================================================================
 *  Products module  (js/products.js)  →  window.JVProducts
 *  ---------------------------------------------------------------------------
 *  The catalog engine shared by the homepage, shop, new-arrivals and product
 *  pages. It:
 *    • fetches products from Supabase (with their variants) when live, or falls
 *      back to the demo catalog in DEMO MODE — same shape either way
 *    • renders the product CARD (image hover-slideshow, wishlist heart,
 *      quick-add) used by every grid
 *    • wires card interactions via event delegation
 * ===========================================================================*/
(function () {
  let _cache = null;

  const firstImages = (p) => (p.images && p.images.length ? p.images : (window.JV_DEMO?.imgSet('navy', '') || [])).slice(0, 4);
  const fromPrice = (p) => p.base_price ?? (p.variants && p.variants.length ? Math.min(...p.variants.map(v => v.price || Infinity)) : 0);

  // Normalise a live Supabase row (variants arrive under product_variants).
  function normalize(p) {
    const variants = p.variants || p.product_variants || [];
    return Object.assign({}, p, { variants, base_price: p.base_price ?? (variants.length ? Math.min(...variants.map(v => v.price)) : 0) });
  }

  async function fetchAll() {
    if (_cache) return _cache;
    if (window.JV_DEMO_MODE || !window.sb) { _cache = window.JV_DEMO.products.map(normalize); return _cache; }
    try {
      const { data, error } = await window.sb
        .from('products')
        .select('*, product_variants(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      _cache = (data || []).map(normalize);
      // If the table is empty, fall back to demo so the site never looks broken.
      if (!_cache.length) _cache = window.JV_DEMO.products.map(normalize);
      return _cache;
    } catch (e) {
      console.warn('[products] live fetch failed, using demo catalog:', e.message);
      _cache = window.JV_DEMO.products.map(normalize);
      return _cache;
    }
  }

  async function fetchById(id) {
    const all = await fetchAll();
    return all.find(p => String(p.id) === String(id) || p.slug === id) || null;
  }

  /* --------------------------- card markup ------------------------------ */
  function cardHTML(p) {
    const imgs = firstImages(p);
    const inWish = window.JVWishlist ? JVWishlist.has(p.id, null) : false;
    const tag = p.is_new_arrival ? `<span class="jv-card-tag">New</span>` : '';
    const dots = imgs.map((_, i) => `<span class="${i === 0 ? 'on' : ''}"></span>`).join('');
    return `
      <article class="jv-product-card" data-id="${p.id}" data-slug="${p.slug || p.id}">
        <div class="jv-product-media">
          <button class="jv-wish-toggle ${inWish ? 'on' : ''}" data-wish aria-label="Add to wishlist" aria-pressed="${inWish}">
            ${JV.icons.heart}
          </button>
          ${tag}
          ${imgs.map((src, i) => `<img class="${i === 0 ? 'active' : ''}" src="${src}" alt="${(p.name || 'Product')} — view ${i + 1}" loading="lazy">`).join('')}
          <div class="jv-media-dots">${dots}</div>
        </div>
        <div class="jv-product-body">
          <span class="jv-product-cat">${JV.catLabel(p.category)}</span>
          <a class="jv-product-name" href="product.html?id=${encodeURIComponent(p.id)}">${p.name}</a>
          <span class="jv-product-price">From ${JV.money(fromPrice(p))}</span>
          <div class="jv-product-actions">
            <button class="jv-btn jv-btn-sm" data-quick-add>Add to Cart</button>
            <a class="jv-btn jv-btn-ghost jv-btn-sm" href="product.html?id=${encodeURIComponent(p.id)}">View</a>
          </div>
        </div>
      </article>`;
  }

  function renderGrid(container, products, cols = 4) {
    if (!container) return;
    if (!products.length) { container.innerHTML = emptyHTML(); return; }
    container.className = `jv-grid cols-${cols}`;
    container.innerHTML = products.map(cardHTML).join('');
    wire(container, products);
  }

  function emptyHTML() {
    return `<div class="jv-empty" style="grid-column:1/-1"><div class="mark"></div><h3>Nothing here yet</h3><p>No pieces match these filters. Try widening your search.</p></div>`;
  }

  function skeleton(container, n = 8, cols = 4) {
    if (!container) return;
    container.className = `jv-grid cols-${cols}`;
    container.innerHTML = Array.from({ length: n }).map(() =>
      `<div class="jv-product-card"><div class="jv-product-media jv-skeleton jv-skeleton-card"></div><div class="jv-product-body"><div class="jv-skeleton" style="height:12px;width:40%"></div><div class="jv-skeleton" style="height:20px;width:80%"></div><div class="jv-skeleton" style="height:16px;width:50%"></div></div></div>`
    ).join('');
  }

  /* --------------------- interactions (delegated) ----------------------- */
  function wire(container, products) {
    const byId = (id) => products.find(p => String(p.id) === String(id));

    // hover slideshow — cycle a card's images while hovered
    JV.qsa('.jv-product-card', container).forEach(card => {
      const imgs = JV.qsa('img', card);
      const dots = JV.qsa('.jv-media-dots span', card);
      if (imgs.length < 2) return;
      let idx = 0, timer = null;
      const show = (n) => {
        imgs[idx].classList.remove('active'); dots[idx]?.classList.remove('on');
        idx = n % imgs.length;
        imgs[idx].classList.add('active'); dots[idx]?.classList.add('on');
      };
      const start = () => { timer = setInterval(() => show(idx + 1), 700); };
      const stop  = () => { clearInterval(timer); show(0); };
      card.addEventListener('mouseenter', start);
      card.addEventListener('mouseleave', stop);
    });

    // wishlist + quick-add (event delegation)
    container.addEventListener('click', (e) => {
      const card = e.target.closest('.jv-product-card'); if (!card) return;
      const p = byId(card.dataset.id); if (!p) return;
      const v = (p.variants && p.variants[0]) || {};
      const snap = { name: p.name, slug: p.slug, image: firstImages(p)[0], price: fromPrice(p), category: p.category, metal: v.metal, size: v.size, color: v.color };

      if (e.target.closest('[data-wish]')) {
        const btn = e.target.closest('[data-wish]');
        const added = JVWishlist.toggle({ product_id: p.id, variant_id: null, snapshot: snap });
        btn.classList.toggle('on', added); btn.setAttribute('aria-pressed', added);
        JV.toast(added ? 'Saved to your wishlist.' : 'Removed from wishlist.', added ? 'success' : 'info');
        return;
      }
      if (e.target.closest('[data-quick-add]')) {
        JVCart.add({ product_id: p.id, variant_id: v.id || null, snapshot: snap }, 1);
        JV.toast(`${p.name} added to cart.`, 'success');
      }
    });
  }

  window.JVProducts = { fetchAll, fetchById, cardHTML, renderGrid, skeleton, fromPrice, firstImages, normalize };
})();
