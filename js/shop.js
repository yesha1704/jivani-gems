/* =============================================================================
 *  Shop module  (js/shop.js)  →  powers shop.html
 *  ---------------------------------------------------------------------------
 *  Builds the filter sidebar from the live catalog, applies multi-facet filters
 *  (category · metal · diamond colour · carat · price · number of diamonds) and
 *  the sort dropdown (price, newest, popularity, diamond quality), then renders
 *  the grid using the shared JVProducts card.
 *
 *  A product matches a facet if ANY of its variants matches (variants differ in
 *  metal/colour/carat/etc).
 * ===========================================================================*/
(function () {
  if (document.body.dataset.page !== 'shop') return;

  const COLORS = ['D', 'E', 'F', 'G', 'H', 'I'];
  const CLARITY_RANK = { FL: 9, IF: 8, VVS1: 7, VVS2: 6, VS1: 5, VS2: 4, SI1: 3, SI2: 2 };
  const state = { category: new Set(), metal: new Set(), color: new Set(), maxCarat: Infinity, maxPrice: Infinity, minDiamonds: 0, sort: 'newest' };

  let ALL = [];

  // variant helpers
  const variantsOf = (p) => p.variants && p.variants.length ? p.variants : [{}];
  const anyVariant = (p, fn) => variantsOf(p).some(fn);
  const qualityScore = (p) => Math.max(...variantsOf(p).map(v => (7 - (COLORS.indexOf(v.color) + 1 || 7)) * 10 + (CLARITY_RANK[v.clarity] || 0)));

  function apply() {
    let list = ALL.filter(p => {
      if (state.category.size && !state.category.has(p.category)) return false;
      if (state.metal.size && !anyVariant(p, v => state.metal.has(v.metal))) return false;
      if (state.color.size && !anyVariant(p, v => state.color.has(v.color))) return false;
      if (isFinite(state.maxCarat) && !anyVariant(p, v => (v.carat || 0) <= state.maxCarat)) return false;
      if (isFinite(state.maxPrice) && JVProducts.fromPrice(p) > state.maxPrice) return false;
      if (state.minDiamonds && !anyVariant(p, v => (v.num_diamonds || 0) >= state.minDiamonds)) return false;
      return true;
    });

    const by = {
      'price-asc':  (a, b) => JVProducts.fromPrice(a) - JVProducts.fromPrice(b),
      'price-desc': (a, b) => JVProducts.fromPrice(b) - JVProducts.fromPrice(a),
      'newest':     (a, b) => new Date(b.created_at) - new Date(a.created_at),
      'popular':    (a, b) => (b.popularity || 0) - (a.popularity || 0),
      'quality':    (a, b) => qualityScore(b) - qualityScore(a),
    }[state.sort];
    if (by) list = [...list].sort(by);

    JV.qs('#shop-count').textContent = `${list.length} piece${list.length === 1 ? '' : 's'}`;
    JVProducts.renderGrid(JV.qs('#shop-grid'), list, 3);
  }

  function buildFilters() {
    const maxCarat = Math.ceil(Math.max(...ALL.flatMap(p => variantsOf(p).map(v => v.carat || 0)), 1));
    const maxPrice = Math.ceil(Math.max(...ALL.map(p => JVProducts.fromPrice(p)), 1000) / 1000) * 1000;
    const cats = [...new Set(ALL.map(p => p.category))];
    const metals = [...new Set(ALL.flatMap(p => variantsOf(p).map(v => v.metal).filter(Boolean)))];

    const checkRows = (name, items, labeller) => items.map(v =>
      `<label class="jv-check"><input type="checkbox" data-facet="${name}" value="${v}">${labeller(v)}</label>`).join('');

    JV.qs('#shop-filters').innerHTML = `
      <div class="jv-filter-group">
        <h4>Category</h4>${checkRows('category', cats, JV.catLabel)}
      </div>
      <div class="jv-filter-group">
        <h4>Metal</h4>${checkRows('metal', metals, JV.metalLabel)}
      </div>
      <div class="jv-filter-group">
        <h4>Diamond Colour</h4>${checkRows('color', COLORS, c => `${c} ${['D','E','F'].includes(c) ? '· Colorless' : '· Near-colorless'}`)}
      </div>
      <div class="jv-filter-group">
        <h4>Carat — up to <span id="carat-val">${maxCarat}</span> ct</h4>
        <input class="jv-range" type="range" min="0.2" max="${maxCarat}" step="0.1" value="${maxCarat}" data-facet="maxCarat">
        <div class="jv-range-vals"><span>0.2 ct</span><span>${maxCarat} ct</span></div>
      </div>
      <div class="jv-filter-group">
        <h4>Price — up to <span id="price-val">${JV.money(maxPrice)}</span></h4>
        <input class="jv-range" type="range" min="0" max="${maxPrice}" step="1000" value="${maxPrice}" data-facet="maxPrice">
        <div class="jv-range-vals"><span>${JV.money(0)}</span><span>${JV.money(maxPrice)}</span></div>
      </div>
      <div class="jv-filter-group">
        <h4>Number of diamonds</h4>
        ${[[0,'Any'],[1,'1+'],[2,'2+'],[10,'10+'],[30,'30+']].map(([v,l],i)=>`<label class="jv-check"><input type="radio" name="ndia" data-facet="minDiamonds" value="${v}" ${i===0?'checked':''}>${l}</label>`).join('')}
      </div>
      <button class="jv-btn-underline" id="clear-filters" style="padding:8px 0">Clear all filters</button>`;

    // wire facet inputs
    JV.qsa('[data-facet]', JV.qs('#shop-filters')).forEach(input => {
      input.addEventListener('input', () => {
        const f = input.dataset.facet;
        if (f === 'category' || f === 'metal' || f === 'color') {
          input.checked ? state[f].add(input.value) : state[f].delete(input.value);
        } else if (f === 'maxCarat') { state.maxCarat = +input.value; JV.qs('#carat-val').textContent = input.value; }
        else if (f === 'maxPrice') { state.maxPrice = +input.value; JV.qs('#price-val').textContent = JV.money(+input.value); }
        else if (f === 'minDiamonds') { state.minDiamonds = +input.value; }
        apply();
      });
    });
    JV.qs('#clear-filters').addEventListener('click', () => { location.href = 'shop.html'; });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    // pre-select category from ?category= (e.g. coming from the nav strip)
    const cat = new URLSearchParams(location.search).get('category');
    if (cat) state.category.add(cat);

    JV.qs('#shop-sort').addEventListener('change', (e) => { state.sort = e.target.value; apply(); });

    JVProducts.skeleton(JV.qs('#shop-grid'), 6, 3);
    ALL = await JVProducts.fetchAll();
    buildFilters();
    if (cat) { const cb = JV.qs(`[data-facet="category"][value="${cat}"]`); if (cb) cb.checked = true; }
    apply();
  });
})();
