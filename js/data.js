/* =============================================================================
 *  DEMO DATA + pricing helpers  (js/data.js)
 *  ---------------------------------------------------------------------------
 *  Two jobs:
 *   1. JV_PRICING  — the rate card used to compute the "price breakdown" popup
 *      on product pages (metal cost + diamond cost + making). These same rates
 *      make the demo prices internally consistent. CUSTOMIZE the rates freely.
 *   2. JV_DEMO     — a sample catalog so the whole site is clickable BEFORE you
 *      connect Supabase. Once your DB has rows, live data replaces this
 *      automatically (see js/products.js). You do NOT ship this to customers as
 *      the real catalog — it's a fallback/preview.
 *
 *  Product images here are on-brand inline SVG (data-URIs) so the demo needs
 *  zero external files. Real products use Supabase Storage image URLs instead.
 * ===========================================================================*/
(function () {

  /* ---------------------- 1. PRICING RATE CARD --------------------------- */
  // CUSTOMIZE: ₹ per gram of metal, ₹ per carat of lab-grown diamond by color,
  // and the making-charge percentage. Used by product-detail "View breakdown".
  const JV_PRICING = {
    metalRatePerGram: { yellow_gold: 6800, rose_gold: 6800, white_gold: 7000, platinum: 3200, silver: 95 },
    diamondRatePerCarat: { D: 32000, E: 30000, F: 28000, G: 26000, H: 24000, I: 22000 },
    makingChargePct: 0.14,

    // Returns an itemized breakdown { lines:[{label,amount}], total }
    computeBreakdown(v) {
      const metalRate   = this.metalRatePerGram[v.metal] ?? 6800;
      const diamondRate = this.diamondRatePerCarat[v.color] ?? 26000;
      const metalCost   = Math.round((v.metal_weight || 0) * metalRate);
      const totalCarats = +(((v.num_diamonds || 0) * (v.per_diamond_weight || 0)) || v.carat || 0).toFixed(2);
      const diamondCost = Math.round(totalCarats * diamondRate);
      const making      = Math.round(metalCost * this.makingChargePct);
      const total       = metalCost + diamondCost + making;
      return {
        total,
        lines: [
          { label: `Metal — ${labelMetal(v.metal)} · ${v.metal_weight || 0} g @ ${money(metalRate)}/g`, amount: metalCost },
          { label: `Diamonds — ${totalCarats} ct (${v.num_diamonds || 0} × ${v.per_diamond_weight || 0} ct) · ${v.color} @ ${money(diamondRate)}/ct`, amount: diamondCost },
          { label: `Making & finishing (${Math.round(this.makingChargePct * 100)}%)`, amount: making },
        ],
      };
    },
  };

  // tiny local money formatter (mirrors JV.money; data.js can load before ui.js)
  function money(n) {
    const c = window.JIVANI_CONFIG || {};
    try { return new Intl.NumberFormat(c.LOCALE || 'en-IN', { style: 'currency', currency: c.CURRENCY || 'INR', maximumFractionDigits: 0 }).format(n); }
    catch { return (c.CURRENCY_SYMBOL || '₹') + Math.round(n).toLocaleString(); }
  }
  function labelMetal(m) { return ({ yellow_gold:'Yellow Gold', rose_gold:'Rose Gold', white_gold:'White Gold', platinum:'Platinum', silver:'Silver' })[m] || m; }

  /* ---------------------- 2. ON-BRAND SVG IMAGES ------------------------- */
  // Builds a navy/champagne diamond illustration as a data-URI. Varying `seed`
  // and `tone` gives each card 4 subtly different "angles" for the hover
  // slideshow, all in the brand palette.
  function gemSVG({ tone = 'navy', seed = 0, label = '' } = {}) {
    const metalStroke = tone === 'gold' ? '#C5AD7A' : tone === 'rose' ? '#C99C92' : tone === 'plat' ? '#AEB6C4' : '#9DA7BD';
    const bg1 = ['#F4F6FA', '#F2EADB', '#F3EFEA', '#EEF1F6'][seed % 4];
    const bg2 = ['#E6EAF2', '#E8DEC8', '#E7E0D8', '#E2E7EF'][seed % 4];
    const rot = [-8, -2, 4, 10][seed % 4];
    const svg = `
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 800'>
  <defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>
    <stop offset='0' stop-color='${bg1}'/><stop offset='1' stop-color='${bg2}'/></linearGradient></defs>
  <rect width='600' height='800' fill='url(#g)'/>
  <ellipse cx='300' cy='540' rx='150' ry='14' fill='#0F1B3D' opacity='0.10'/>
  <g transform='translate(300 360) rotate(${rot}) scale(2.4)'>
    <path d='M -50 22 a 50 14 0 0 0 100 0' fill='none' stroke='${metalStroke}' stroke-width='3.2'/>
    <path d='M -50 22 a 50 14 0 0 1 100 0' fill='none' stroke='${metalStroke}' stroke-width='3.6'/>
    <line x1='-14' y1='10' x2='-12' y2='-2' stroke='${metalStroke}' stroke-width='1.5' stroke-linecap='round'/>
    <line x1='14' y1='10' x2='12' y2='-2' stroke='${metalStroke}' stroke-width='1.5' stroke-linecap='round'/>
    <polygon points='-22,-12 0,-46 22,-12 0,8' fill='#FAFAF7' stroke='#0F1B3D' stroke-width='0.7'/>
    <polygon points='-22,-12 -10,-20 0,-46' fill='#E8EAF0'/>
    <polygon points='22,-12 10,-20 0,-46' fill='#B8BDC9'/>
    <polygon points='-22,-12 0,8 22,-12' fill='#7D889F' opacity='0.55'/>
    <polygon points='-10,-20 0,-46 10,-20 0,-28' fill='#FAFAF7' opacity='0.85'/>
  </g>
  ${label ? `<text x='300' y='726' text-anchor='middle' font-family='Manrope,sans-serif' font-size='17' letter-spacing='5' fill='#0F1B3D' opacity='0.5'>${label}</text>` : ''}
</svg>`.trim();
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  // four-frame image set for a product (for the hover slideshow)
  function imgSet(tone, code) { return [0,1,2,3].map(seed => gemSVG({ tone, seed, label: code })); }

  /* ---------------------- 3. VARIANT BUILDER ----------------------------- */
  let vid = 0;
  function variant(p) {
    // auto-compute the variant price from the rate card so demo data is consistent
    const price = JV_PRICING.computeBreakdown(p).total;
    return Object.assign({
      id: 'demo-v' + (++vid), size: null, color: 'F', metal: 'white_gold',
      carat: 1.0, num_diamonds: 1, cut: 'Round Brilliant', per_diamond_weight: 1.0,
      metal_weight: 4, clarity: 'VS1', stock: 'in stock',
    }, p, { price });
  }

  /* ---------------------- 4. DEMO CATALOG -------------------------------- */
  const now = Date.now();
  const day = 86400000;
  const tone = (m) => m === 'yellow_gold' ? 'gold' : m === 'rose_gold' ? 'rose' : m === 'platinum' ? 'plat' : 'navy';

  const DEMO_PRODUCTS = [
    {
      id: 'demo-1', slug: 'aria-solitaire', name: 'Aria Solitaire', category: 'rings',
      description: 'A 1.20ct round brilliant lab-grown solitaire set in 18k recycled gold — the quiet centrepiece of the Aria collection.',
      base_price: null, is_new_arrival: true, popularity: 98, created_at: new Date(now - 2*day).toISOString(),
      images: imgSet('navy', 'AR-014'),
      variants: [
        variant({ size: '6',  color: 'D', metal: 'white_gold',  carat: 1.20, num_diamonds: 1, per_diamond_weight: 1.20, metal_weight: 4.0, clarity: 'VVS2' }),
        variant({ size: '7',  color: 'F', metal: 'yellow_gold', carat: 1.20, num_diamonds: 1, per_diamond_weight: 1.20, metal_weight: 4.2, clarity: 'VS1' }),
        variant({ size: '8',  color: 'F', metal: 'rose_gold',   carat: 1.50, num_diamonds: 1, per_diamond_weight: 1.50, metal_weight: 4.2, clarity: 'VS1' }),
      ],
    },
    {
      id: 'demo-2', slug: 'halo-aurelia', name: 'Aurelia Halo', category: 'rings',
      description: 'A brilliant centre framed by a halo of pavé stones. Maximum sparkle, minimal weight.',
      base_price: null, is_new_arrival: true, popularity: 91, created_at: new Date(now - 5*day).toISOString(),
      images: imgSet('gold', 'AU-022'),
      variants: [
        variant({ size: '6', color: 'E', metal: 'yellow_gold', carat: 1.10, num_diamonds: 25, per_diamond_weight: 0.044, metal_weight: 3.6, clarity: 'VS1' }),
        variant({ size: '7', color: 'F', metal: 'white_gold',  carat: 1.10, num_diamonds: 25, per_diamond_weight: 0.044, metal_weight: 3.6, clarity: 'VS2' }),
      ],
    },
    {
      id: 'demo-3', slug: 'eternity-band', name: 'Lumière Eternity Band', category: 'rings',
      description: 'A full circle of shared-prong rounds — 2.0ct total. A wedding band that never stops moving.',
      base_price: null, is_new_arrival: false, popularity: 84, created_at: new Date(now - 30*day).toISOString(),
      images: imgSet('plat', 'LM-007'),
      variants: [
        variant({ size: '6', color: 'F', metal: 'platinum',   carat: 2.0, num_diamonds: 20, per_diamond_weight: 0.10, metal_weight: 5.0, clarity: 'VS1' }),
        variant({ size: '7', color: 'G', metal: 'white_gold',  carat: 2.0, num_diamonds: 20, per_diamond_weight: 0.10, metal_weight: 4.6, clarity: 'VS2' }),
      ],
    },
    {
      id: 'demo-4', slug: 'celeste-studs', name: 'Celeste Studs', category: 'earrings',
      description: 'Four-prong martini studs, 1.0ct each. The everyday brilliant that goes with everything.',
      base_price: null, is_new_arrival: true, popularity: 95, created_at: new Date(now - 3*day).toISOString(),
      images: imgSet('navy', 'CE-101'),
      variants: [
        variant({ color: 'D', metal: 'white_gold',  carat: 2.0, num_diamonds: 2, per_diamond_weight: 1.0, metal_weight: 2.4, clarity: 'VVS2' }),
        variant({ color: 'F', metal: 'yellow_gold', carat: 1.0, num_diamonds: 2, per_diamond_weight: 0.5, metal_weight: 2.2, clarity: 'VS1' }),
      ],
    },
    {
      id: 'demo-5', slug: 'riviera-necklace', name: 'Riviera Line Necklace', category: 'necklace',
      description: 'A graduated riviera of 36 rounds totalling 5ct, strung on 18k gold. Red-carpet, reimagined.',
      base_price: null, is_new_arrival: false, popularity: 88, created_at: new Date(now - 18*day).toISOString(),
      images: imgSet('gold', 'RV-300'),
      variants: [
        variant({ color: 'F', metal: 'yellow_gold', carat: 5.0, num_diamonds: 36, per_diamond_weight: 0.139, metal_weight: 9.5, clarity: 'VS1' }),
        variant({ color: 'G', metal: 'white_gold',  carat: 5.0, num_diamonds: 36, per_diamond_weight: 0.139, metal_weight: 9.0, clarity: 'VS2' }),
      ],
    },
    {
      id: 'demo-6', slug: 'solene-pendant-set', name: 'Solène Pendant Set', category: 'pendant_set',
      description: 'A matching pendant and stud set — a 0.75ct solitaire pendant with 0.5ct companion studs.',
      base_price: null, is_new_arrival: true, popularity: 80, created_at: new Date(now - 6*day).toISOString(),
      images: imgSet('rose', 'SO-210'),
      variants: [
        variant({ color: 'F', metal: 'rose_gold',  carat: 1.25, num_diamonds: 3, per_diamond_weight: 0.42, metal_weight: 4.0, clarity: 'VS1' }),
        variant({ color: 'E', metal: 'white_gold', carat: 1.25, num_diamonds: 3, per_diamond_weight: 0.42, metal_weight: 3.8, clarity: 'VVS2' }),
      ],
    },
    {
      id: 'demo-7', slug: 'margot-choker', name: 'Margot Choker', category: 'choker',
      description: 'A close-fitting choker of bezel-set rounds — architectural, modern, unmistakably evening.',
      base_price: null, is_new_arrival: false, popularity: 72, created_at: new Date(now - 40*day).toISOString(),
      images: imgSet('navy', 'MG-118'),
      variants: [
        variant({ color: 'G', metal: 'white_gold',  carat: 3.0, num_diamonds: 30, per_diamond_weight: 0.10, metal_weight: 12, clarity: 'VS2' }),
      ],
    },
    {
      id: 'demo-8', slug: 'vega-tennis-bracelet', name: 'Vega Tennis Bracelet', category: 'bracelet',
      description: 'The classic four-prong tennis bracelet — 4ct of perfectly matched rounds in a flexible line.',
      base_price: null, is_new_arrival: true, popularity: 90, created_at: new Date(now - 4*day).toISOString(),
      images: imgSet('plat', 'VG-440'),
      variants: [
        variant({ size: '6.5"', color: 'F', metal: 'platinum',  carat: 4.0, num_diamonds: 40, per_diamond_weight: 0.10, metal_weight: 8, clarity: 'VS1' }),
        variant({ size: '7"',   color: 'G', metal: 'white_gold', carat: 4.0, num_diamonds: 40, per_diamond_weight: 0.10, metal_weight: 7.4, clarity: 'VS2' }),
      ],
    },
    {
      id: 'demo-9', slug: 'lune-anklet', name: 'Lune Anklet', category: 'anklet',
      description: 'A whisper-fine anklet scattered with 1.0ct of tiny brilliants. Barely-there shimmer.',
      base_price: null, is_new_arrival: false, popularity: 60, created_at: new Date(now - 50*day).toISOString(),
      images: imgSet('gold', 'LU-090'),
      variants: [
        variant({ size: '9"',  color: 'H', metal: 'yellow_gold', carat: 1.0, num_diamonds: 20, per_diamond_weight: 0.05, metal_weight: 3, clarity: 'VS2' }),
      ],
    },
    {
      id: 'demo-10', slug: 'loose-round-brilliant', name: 'Loose Round Brilliant — 2.0ct', category: 'loose_diamond',
      description: 'A single IGI-certified 2.0ct round brilliant, D colour, VVS1. Set it your way with a custom order.',
      base_price: null, is_new_arrival: true, popularity: 77, created_at: new Date(now - 1*day).toISOString(),
      images: imgSet('navy', 'LD-200'),
      variants: [
        variant({ size: null, color: 'D', metal: 'silver', carat: 2.0, num_diamonds: 1, per_diamond_weight: 2.0, metal_weight: 0, clarity: 'VVS1' }),
        variant({ size: null, color: 'E', metal: 'silver', carat: 1.5, num_diamonds: 1, per_diamond_weight: 1.5, metal_weight: 0, clarity: 'VVS2' }),
      ],
    },
  ];

  // Fill base_price = lowest variant price ("from" price shown on cards)
  DEMO_PRODUCTS.forEach(p => { p.base_price = Math.min(...p.variants.map(v => v.price)); });

  /* ---------------------- 5. DEMO REVIEWS -------------------------------- */
  const DEMO_REVIEWS = [
    { id: 'r1', product_id: 'demo-1', author: 'Priya M.', rating: 5, review_text: 'The Aria solitaire is even more beautiful in person. The certification gave me total peace of mind.', created_at: new Date(now - 8*day).toISOString() },
    { id: 'r2', product_id: 'demo-4', author: 'Ananya R.', rating: 5, review_text: 'Wear my Celeste studs every single day. Impossible to tell they are lab-grown — and I love that they are.', created_at: new Date(now - 12*day).toISOString() },
    { id: 'r3', product_id: null,     author: 'Karan S.', rating: 5, review_text: 'Bought a custom band for our anniversary. The team walked me through every step. Flawless service.', created_at: new Date(now - 20*day).toISOString() },
    { id: 'r4', product_id: 'demo-8', author: 'Meera T.', rating: 4, review_text: 'Gorgeous tennis bracelet, brilliant sparkle. Took a few days longer than expected to arrive.', created_at: new Date(now - 26*day).toISOString() },
  ];

  /* ---------------------- 6. EXPOSE -------------------------------------- */
  window.JV_PRICING = JV_PRICING;
  window.JV_DEMO = {
    products: DEMO_PRODUCTS,
    reviews: DEMO_REVIEWS,
    placeholder: gemSVG,
    imgSet,
  };
})();
