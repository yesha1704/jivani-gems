/* =============================================================================
 *  Product detail  (js/product-detail.js)  →  powers product.html
 *  ---------------------------------------------------------------------------
 *  URL: product.html?id=<product id or slug>
 *  Renders gallery, variant selectors (metal / colour / size) with LIVE price,
 *  a "view price breakdown" popup (metal + diamonds + making), full specs,
 *  add-to-cart / wishlist, reviews for this product, and "you may also like".
 * ===========================================================================*/
(function () {
  if (document.body.dataset.page !== 'product') return;
  const cfg = window.JIVANI_CONFIG || {};

  let product = null, current = null;   // current = selected variant

  const variants = () => product.variants && product.variants.length ? product.variants : [{ price: product.base_price }];
  const distinct = (key) => [...new Set(variants().map(v => v[key]).filter(v => v != null && v !== ''))];

  // approximate round-diamond face diameter (mm) for the "dimensions" spec
  const dimsFor = (v) => {
    const ct = (v.per_diamond_weight || v.carat || 0);
    if (!ct) return '—';
    const d = (6.5 * Math.cbrt(ct)).toFixed(1);
    return `≈ ${d} mm ${(v.cut || 'round').toLowerCase().includes('round') ? 'Ø' : 'face'}`;
  };

  function pickVariant({ metal, color, size }) {
    const v = variants();
    const score = (x) => (metal && x.metal === metal ? 4 : 0) + (color && x.color === color ? 2 : 0) + (size && x.size === size ? 1 : 0);
    return [...v].sort((a, b) => score(b) - score(a))[0] || v[0];
  }

  /* --------------------------- gallery ---------------------------------- */
  function renderGallery() {
    const imgs = JVProducts.firstImages(product);
    JV.qs('#pd-main').src = imgs[0];
    JV.qs('#pd-main').alt = product.name;
    JV.qs('#pd-thumbs').innerHTML = imgs.map((src, i) =>
      `<button class="pd-thumb ${i === 0 ? 'on' : ''}" data-src="${src}" aria-label="View image ${i + 1}"><img src="${src}" alt=""></button>`).join('');
    JV.qsa('.pd-thumb').forEach(t => t.addEventListener('click', () => {
      JV.qs('#pd-main').src = t.dataset.src;
      JV.qsa('.pd-thumb').forEach(x => x.classList.toggle('on', x === t));
    }));
  }

  /* --------------------------- variant UI ------------------------------- */
  function buildSelectors() {
    const mk = (id, key, label, labeller) => {
      const opts = distinct(key);
      if (!opts.length) { JV.qs('#' + id).closest('.pd-selector').style.display = 'none'; return; }
      JV.qs('#' + id).innerHTML = opts.map(o => `<option value="${o}">${labeller ? labeller(o) : o}</option>`).join('');
    };
    mk('pd-metal', 'metal', 'Metal', JV.metalLabel);
    mk('pd-color', 'color', 'Colour', c => `${c} ${['D','E','F'].includes(c) ? '(Colorless)' : '(Near-colorless)'}`);
    mk('pd-size', 'size', 'Size', s => `Size ${s}`);

    JV.qsa('.pd-selector select').forEach(sel => sel.addEventListener('change', syncFromSelectors));
  }

  function syncFromSelectors() {
    current = pickVariant({ metal: JV.qs('#pd-metal').value, color: JV.qs('#pd-color').value, size: JV.qs('#pd-size').value });
    // reflect the actually-chosen variant back into the selectors
    if (current.metal) JV.qs('#pd-metal').value = current.metal;
    if (current.color) JV.qs('#pd-color').value = current.color;
    if (current.size) JV.qs('#pd-size').value = current.size;
    renderPriceAndSpecs();
  }

  function renderPriceAndSpecs() {
    JV.qs('#pd-price').textContent = JV.money(current.price);
    const inStock = (current.stock || 'in stock').toLowerCase().includes('in');
    const stockEl = JV.qs('#pd-stock');
    stockEl.textContent = inStock ? 'In stock · ships in 2–3 days' : 'Made to order · 3–4 weeks';
    stockEl.className = inStock ? 'muted' : 'muted';
    JV.qs('#pd-add').disabled = false;

    JV.qs('#pd-specs').innerHTML = [
      ['Carat (total)', `${current.carat || '—'} ct`],
      ['Number of diamonds', current.num_diamonds ?? '—'],
      ['Per-diamond weight', `${current.per_diamond_weight || '—'} ct`],
      ['Cut', current.cut || '—'],
      ['Diamond colour', current.color || '—'],
      ['Clarity', current.clarity || '—'],
      ['Metal', JV.metalLabel(current.metal)],
      ['Metal weight', `${current.metal_weight || '—'} g`],
      ['Dimensions', dimsFor(current)],
      ['Certification', 'IGI / GIA'],
    ].map(([k, v]) => `<div class="jv-spec"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');
  }

  /* --------------------------- breakdown -------------------------------- */
  function showBreakdown() {
    const b = JV_PRICING.computeBreakdown(current);
    const rows = b.lines.map(l => `<div class="jv-summary-row"><span style="max-width:74%">${l.label}</span><span>${JV.money(l.amount)}</span></div>`).join('');
    JV.modal(`
      <div style="font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:var(--muted)">Price breakdown</div>
      <h3 class="serif" style="font-size:26px;margin:8px 0 18px">${product.name}</h3>
      ${rows}
      <div class="jv-summary-row total"><span>Total</span><span>${JV.money(b.total)}</span></div>
      <p class="muted" style="font-size:12px;margin-top:14px">Indicative breakdown at current rates. Final price shown above. Taxes calculated at checkout.</p>`);
  }

  /* --------------------------- reviews ---------------------------------- */
  async function loadReviews() {
    let reviews = [];
    if (window.JV_DEMO_MODE || !window.sb) {
      reviews = (window.JV_DEMO.reviews || []).filter(r => r.product_id === product.id);
    } else {
      try {
        const { data } = await window.sb.from('reviews').select('*, profiles(full_name)').eq('product_id', product.id).order('created_at', { ascending: false });
        reviews = (data || []).map(r => ({ ...r, author: r.profiles?.full_name || 'Verified buyer' }));
      } catch { reviews = []; }
    }
    const wrap = JV.qs('#pd-reviews');
    const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : 0;
    JV.qs('#pd-rating-summary').innerHTML = reviews.length
      ? `${starRow(Math.round(avg))} <span class="muted" style="margin-left:10px">${avg.toFixed(1)} · ${reviews.length} review${reviews.length>1?'s':''}</span>`
      : `<span class="muted">No reviews yet — <a class="jv-link-underline" style="border-color:var(--navy)" href="feedback.html?product=${encodeURIComponent(product.id)}">be the first</a></span>`;
    wrap.innerHTML = reviews.map(r => `
      <div style="border-top:1px solid var(--line);padding:22px 0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong style="font-weight:600">${r.author || 'Verified buyer'}</strong>${starRow(r.rating)}
        </div>
        <p style="color:var(--body)">${escapeHTML(r.review_text)}</p>
      </div>`).join('');
  }
  const starRow = (n) => `<span class="jv-stars">${Array.from({length:5}).map((_,i)=>`<svg viewBox="0 0 24 24" class="${i<n?'jv-star-on':'jv-star-off'}"><path d="M12 2l3 6.5 7 .8-5 4.8 1.3 7L12 17.8 5.4 21l1.3-7-5-4.8 7-.8z" stroke-width="1"/></svg>`).join('')}</span>`;
  const escapeHTML = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

  /* --------------------- you may also like ------------------------------ */
  async function loadRelated() {
    const all = await JVProducts.fetchAll();
    let rel = all.filter(p => p.id !== product.id && p.category === product.category);
    if (rel.length < 4) rel = rel.concat(all.filter(p => p.id !== product.id && p.category !== product.category));
    JVProducts.renderGrid(JV.qs('#pd-related'), rel.slice(0, 4), 4);
  }

  /* --------------------------- add to cart ------------------------------ */
  function snap() {
    return { name: product.name, slug: product.slug, image: JVProducts.firstImages(product)[0], price: current.price,
      category: product.category, metal: current.metal, size: current.size, color: current.color };
  }

  /* --------------------------- boot ------------------------------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    const id = new URLSearchParams(location.search).get('id');
    const stage = JV.qs('#pd-stage');
    if (!id) { stage.innerHTML = notFound(); return; }

    product = await JVProducts.fetchById(id);
    if (!product) { stage.innerHTML = notFound(); return; }

    // SEO: set the title/description dynamically for this product
    document.title = `${product.name} — Jivani Gems`;
    JV.qs('meta[name="description"]')?.setAttribute('content', (product.description || '').slice(0, 155));

    JV.qs('#pd-cat').textContent = JV.catLabel(product.category);
    JV.qs('#pd-name').textContent = product.name;
    JV.qs('#pd-desc').textContent = product.description || '';
    if (product.is_new_arrival) JV.qs('#pd-newtag').style.display = 'inline-block';

    renderGallery();
    buildSelectors();
    current = variants()[0];
    syncFromSelectors();
    stage.style.visibility = 'visible';

    JV.qs('#pd-breakdown').addEventListener('click', showBreakdown);
    JV.qs('#pd-add').addEventListener('click', () => {
      JVCart.add({ product_id: product.id, variant_id: current.id || null, snapshot: snap() }, 1);
      JV.toast(`${product.name} added to cart.`, 'success');
    });
    JV.qs('#pd-wish').addEventListener('click', (e) => {
      const added = JVWishlist.toggle({ product_id: product.id, variant_id: current.id || null, snapshot: snap() });
      e.currentTarget.classList.toggle('on', added);
      JV.toast(added ? 'Saved to wishlist.' : 'Removed from wishlist.', added ? 'success' : 'info');
    });

    loadReviews(); loadRelated();
  });

  function notFound() {
    return `<div class="jv-empty"><div class="mark"></div><h3>Piece not found</h3><p>We couldn’t find that piece. It may have sold or the link is out of date.</p><a class="jv-btn jv-btn-sm" href="shop.html">Back to the collection</a></div>`;
  }
})();
