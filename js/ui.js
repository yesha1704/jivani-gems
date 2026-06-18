/* =============================================================================
 *  UI / chrome module  (js/ui.js)
 *  ---------------------------------------------------------------------------
 *  The shared "chrome" for every page so we never duplicate the navbar/footer:
 *    • injects announcement bar, sticky header, nav, category strip, mobile
 *      drawer and footer into each page
 *    • exposes the global `JV` helper namespace used across all modules:
 *        JV.money()        – currency formatting
 *        JV.toast()        – non-blocking notifications (never shows raw errors)
 *        JV.updateBadges() – cart/wishlist count bubbles
 *        JV.setUser()      – swap "Account" ⇄ "Welcome back, <name>"
 *        JV.modal / JV.qs / JV.ce – small DOM helpers
 *
 *  Each page opts in by adding  <body data-page="shop">  (the value highlights
 *  the active nav link). Add  data-no-chrome  to skip injection (rare).
 * ===========================================================================*/
(function () {
  const cfg = window.JIVANI_CONFIG || {};
  const JV = window.JV = window.JV || {};

  /* ----------------------------- helpers -------------------------------- */
  JV.qs  = (sel, root = document) => root.querySelector(sel);
  JV.qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  JV.ce  = (tag, props = {}, html) => { const e = Object.assign(document.createElement(tag), props); if (html != null) e.innerHTML = html; return e; };

  JV.money = (n) => {
    const v = Number(n) || 0;
    try { return new Intl.NumberFormat(cfg.LOCALE || 'en-IN', { style: 'currency', currency: cfg.CURRENCY || 'INR', maximumFractionDigits: 0 }).format(v); }
    catch { return (cfg.CURRENCY_SYMBOL || '₹') + Math.round(v).toLocaleString(); }
  };

  // human-readable category label
  JV.catLabel = (c) => ({
    rings: 'Rings', earrings: 'Earrings', necklace: 'Necklaces', choker: 'Chokers',
    pendant_set: 'Pendant Sets', anklet: 'Anklets', bracelet: 'Bracelets', loose_diamond: 'Loose Diamonds',
  }[c] || c);
  JV.metalLabel = (m) => ({ yellow_gold:'Yellow Gold', rose_gold:'Rose Gold', white_gold:'White Gold', platinum:'Platinum', silver:'Silver' }[m] || m);

  /* ----------------------------- toasts --------------------------------- */
  // Friendly, non-blocking messages. We NEVER surface raw error objects here.
  JV.toast = (message, type = 'info', ms = 3800) => {
    let wrap = JV.qs('.jv-toast-wrap');
    if (!wrap) { wrap = JV.ce('div', { className: 'jv-toast-wrap' }); document.body.appendChild(wrap); }
    const t = JV.ce('div', { className: `jv-toast ${type}` }, `<span>${message}</span>`);
    wrap.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, ms);
  };

  /* ----------------------------- modal ---------------------------------- */
  JV.modal = (innerHTML) => {
    const back = JV.ce('div', { className: 'jv-modal-backdrop' },
      `<div class="jv-modal" role="dialog" aria-modal="true"><button class="jv-modal-close" aria-label="Close">×</button><div class="jv-modal-content">${innerHTML}</div></div>`);
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add('open'));
    const close = () => { back.classList.remove('open'); setTimeout(() => back.remove(), 300); };
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    back.querySelector('.jv-modal-close').addEventListener('click', close);
    document.addEventListener('keydown', function esc(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown', esc);} });
    return { close, el: back };
  };

  /* ----------------------------- icons ---------------------------------- */
  const I = {
    search: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5" stroke-linecap="round"/></svg>`,
    heart:  `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 20.5s-7.5-4.8-7.5-10.5a4.2 4.2 0 0 1 7.5-2.7 4.2 4.2 0 0 1 7.5 2.7c0 5.7-7.5 10.5-7.5 10.5z" stroke-linejoin="round"/></svg>`,
    cart:   `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 7.5h14l-1.2 12.1a1.6 1.6 0 0 1-1.6 1.4H7.8a1.6 1.6 0 0 1-1.6-1.4L5 7.5z" stroke-linejoin="round"/><path d="M9 7.5V5.5a3 3 0 0 1 6 0v2" stroke-linejoin="round"/></svg>`,
    user:   `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" stroke-linecap="round"/></svg>`,
    arrow:  `<svg width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M0 5h17m0 0L13 1m4 4L13 9" stroke-linecap="square"/></svg>`,
    ig:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c8d0e1" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6" fill="#c8d0e1"/></svg>`,
    x: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#c8d0e1"><path d="M22 5.8c-.8.4-1.6.6-2.5.7.9-.5 1.6-1.4 1.9-2.4-.8.5-1.8.9-2.7 1.1A4.3 4.3 0 0 0 11.3 9c0 .3 0 .7.1 1A12 12 0 0 1 2.7 5.6c-.4.7-.6 1.5-.6 2.3 0 1.5.8 2.8 2 3.6-.7 0-1.4-.2-2-.5 0 2.1 1.5 3.8 3.5 4.2-.4.1-.8.2-1.2.2l-.8-.1c.6 1.7 2.2 3 4.1 3-1.5 1.2-3.4 1.9-5.4 1.9H1a12 12 0 0 0 6.5 1.9c7.8 0 12-6.5 12-12.1v-.6c.8-.6 1.6-1.3 2.1-2.1z"/></svg>`,
    fb:`<svg width="14" height="14" viewBox="0 0 24 24" fill="#c8d0e1"><path d="M12 2C6.5 2 2 6.5 2 12c0 4.4 2.9 8.2 6.8 9.5v-6.7H6.6V12h2.2V9.9c0-2.2 1.3-3.4 3.3-3.4 1 0 2 .2 2 .2v2.2H13c-1.1 0-1.4.7-1.4 1.4V12h2.4l-.4 2.8h-2v6.7C19.1 20.2 22 16.4 22 12c0-5.5-4.5-10-10-10z"/></svg>`,
    in:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c8d0e1" stroke-width="1.5"><rect x="2" y="9" width="4" height="13"/><circle cx="4" cy="4" r="2"/><path d="M9 9h4v2a4 4 0 0 1 7 3v8h-4v-7a2 2 0 0 0-4 0v7H9V9z"/></svg>`,
  };
  JV.icons = I;

  /* ------------------------- nav configuration -------------------------- */
  // Single source of truth for the primary nav (keeps every page in sync).
  const NAV = [
    { label: 'Home',         href: 'index.html',        page: 'home' },
    { label: 'New Arrivals', href: 'new-arrivals.html', page: 'new' },
    { label: 'Shop',         href: 'shop.html',         page: 'shop' },
    { label: 'Custom Order', href: 'custom-order.html', page: 'custom' },
    { label: 'About',        href: 'about.html',        page: 'about' },
    { label: 'Contact',      href: 'contact.html',      page: 'contact' },
  ];
  const CATS = [
    { label: 'Engagement',   href: 'shop.html?category=rings' },
    { label: 'Earrings',     href: 'shop.html?category=earrings' },
    { label: 'Necklaces',    href: 'shop.html?category=necklace' },
    { label: 'Bracelets',    href: 'shop.html?category=bracelet' },
    { label: 'Loose Diamonds', href: 'shop.html?category=loose_diamond' },
    { label: 'Trending', href: 'new-arrivals.html', sup: 'NEW', hot: true },
  ];

  /* --------------------------- chrome markup ---------------------------- */
  function headerHTML(active) {
    const navLinks = NAV.map(n => `<a href="${n.href}" data-nav="${n.page}" class="${n.page===active?'active':''}">${n.label}</a>`).join('');
    const catLinks = CATS.map(c => `<a href="${c.href}" class="${c.hot?'hot':''}">${c.label}${c.sup?` <sup>${c.sup}</sup>`:''}</a>`).join('');
    return `
    <div class="jv-announce">Complimentary shipping &amp; lifetime warranty &nbsp;·&nbsp; Free resizing within 60 days</div>
    <header class="jv-header">
      <div class="jv-header-row">
        <button class="jv-burger" aria-label="Open menu" aria-expanded="false">
          <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="#0F1B3D" stroke-width="1.4"><line x1="0" y1="1" x2="20" y2="1"/><line x1="0" y1="7" x2="20" y2="7"/><line x1="0" y1="13" x2="14" y2="13"/></svg>
        </button>
        <div class="jv-header-left"><span data-greeting>USD&nbsp;·&nbsp;EN</span></div>
        <a class="jv-logo-block" href="index.html" aria-label="Jivani Gems home">
          <span class="jv-logo-flourish"><span></span><span></span><span></span></span>
          <span class="jv-logo">JIVANI&nbsp;GEMS</span>
          <span class="jv-tagline">LAB-GROWN · CERTIFIED · ETERNAL</span>
        </a>
        <div class="jv-header-icons">
          <a class="jv-icon-btn" href="shop.html" title="Search / shop" aria-label="Shop">${I.search}</a>
          <a class="jv-icon-btn" data-account-link href="account.html" title="Account" aria-label="Account">${I.user}</a>
          <a class="jv-icon-btn" href="wishlist.html" title="Wishlist" aria-label="Wishlist">${I.heart}<span class="jv-count-badge" data-wish-count data-count="0">0</span></a>
          <a class="jv-icon-btn" href="cart.html" title="Cart" aria-label="Cart">${I.cart}<span class="jv-count-badge" data-cart-count data-count="0">0</span></a>
        </div>
      </div>
      <nav class="jv-main-nav">${navLinks}</nav>
      <div class="jv-category-strip-wrap"><div class="jv-category-strip">${catLinks}</div></div>
    </header>
    <div class="jv-mobile-drawer" aria-hidden="true">
      <button class="jv-drawer-close" aria-label="Close menu">×</button>
      ${NAV.map(n=>`<a href="${n.href}">${n.label}</a>`).join('')}
      <a href="wishlist.html">Wishlist</a>
      <a href="cart.html">Cart</a>
      <a href="account.html" data-account-link>Account</a>
      <a href="feedback.html">Reviews</a>
    </div>`;
  }

  function footerHTML() {
    const col = (h, links) => `<div><h5>${h}</h5><ul class="jv-footer-links">${links.map(l=>`<a href="${l[1]}">${l[0]}</a>`).join('')}</ul></div>`;
    return `
    <footer class="jv-footer">
      <div class="jv-container">
        <div class="jv-footer-grid">
          <div class="jv-footer-brand">
            <div class="jv-logo">JIVANI&nbsp;GEMS</div>
            <div class="jv-footer-tag">LAB-GROWN · CERTIFIED · ETERNAL</div>
            <p class="jv-footer-about">A modern atelier crafting laboratory diamonds with the patience of mined stones and the conscience of the next century.</p>
            <div class="jv-social">
              <a href="#" aria-label="Instagram">${I.ig}</a>
              <a href="#" aria-label="X / Twitter">${I.x}</a>
              <a href="#" aria-label="Facebook">${I.fb}</a>
              <a href="#" aria-label="LinkedIn">${I.in}</a>
            </div>
          </div>
          ${col('Shop', [['New Arrivals','new-arrivals.html'],['Engagement Rings','shop.html?category=rings'],['Earrings','shop.html?category=earrings'],['Necklaces','shop.html?category=necklace'],['Bracelets','shop.html?category=bracelet'],['Loose Diamonds','shop.html?category=loose_diamond']])}
          ${col('The House', [['About Us','about.html'],['Custom Order','custom-order.html'],['Reviews','feedback.html'],['Sustainability','about.html#values'],['Why Lab-Grown','about.html#why']])}
          ${col('Service', [['Contact Us','contact.html'],['My Account','account.html'],['Wishlist','wishlist.html'],['Shipping & Returns','contact.html'],['Lifetime Warranty','contact.html']])}
          <div>
            <h5>Visit</h5>
            <div class="jv-footer-visit">
              <div class="place">The Atelier</div>
              By appointment<br>Mon – Sat, 11am – 7pm<br>
              <span style="color:var(--navy-soft)">${cfg.CONTACT_EMAIL || 'hello@jivanigems.com'}</span>
            </div>
          </div>
        </div>
        <div class="jv-footer-bottom">
          <div>© ${new Date().getFullYear()} ${cfg.SITE_NAME || 'Jivani Gems'} · All diamonds IGI &amp; GIA certified.</div>
          <div class="jv-footer-legal">
            <a href="#">Privacy</a><a href="#">Terms</a><a href="#">Cookies</a><a href="#">Accessibility</a>
          </div>
          <div>${cfg.CURRENCY_SYMBOL || '₹'}&nbsp;${cfg.CURRENCY || 'INR'}&nbsp;·&nbsp;EN</div>
        </div>
      </div>
    </footer>`;
  }

  /* --------------------------- badge + user ----------------------------- */
  JV.updateBadges = () => {
    const cart = (window.JVCart && JVCart.count) ? JVCart.count() : 0;
    const wish = (window.JVWishlist && JVWishlist.count) ? JVWishlist.count() : 0;
    JV.qsa('[data-cart-count]').forEach(b => { b.textContent = cart; b.dataset.count = cart; });
    JV.qsa('[data-wish-count]').forEach(b => { b.textContent = wish; b.dataset.count = wish; });
  };

  // Called by auth.js when the session resolves. profile=null → logged out.
  JV.setUser = (profile) => {
    const name = profile && (profile.full_name || '').trim().split(' ')[0];
    JV.qsa('[data-greeting]').forEach(g => {
      g.textContent = name ? `Welcome back, ${name}` : `${cfg.CURRENCY_SYMBOL||'₹'} ${cfg.CURRENCY||'INR'} · EN`;
    });
    JV.qsa('[data-account-link]').forEach(a => { a.setAttribute('href', profile ? 'account.html' : 'login.html'); });
  };

  /* --------------------------- mount + wire ----------------------------- */
  function wireDrawer() {
    const drawer = JV.qs('.jv-mobile-drawer');
    const burger = JV.qs('.jv-burger');
    if (!drawer || !burger) return;
    const open = () => { drawer.classList.add('open'); burger.setAttribute('aria-expanded','true'); drawer.setAttribute('aria-hidden','false'); };
    const close = () => { drawer.classList.remove('open'); burger.setAttribute('aria-expanded','false'); drawer.setAttribute('aria-hidden','true'); };
    burger.addEventListener('click', open);
    JV.qs('.jv-drawer-close', drawer)?.addEventListener('click', close);
    JV.qsa('a', drawer).forEach(a => a.addEventListener('click', close));
  }

  JV.mountChrome = (active) => {
    if (document.body.hasAttribute('data-no-chrome')) return;
    active = active || document.body.dataset.page || '';
    // inject header at top, footer at bottom
    document.body.insertAdjacentHTML('afterbegin', headerHTML(active));
    document.body.insertAdjacentHTML('beforeend', footerHTML());
    wireDrawer();
    JV.updateBadges();
  };

  // Auto-mount on load (pages can call JV.mountChrome manually instead).
  document.addEventListener('DOMContentLoaded', () => { if (!JV._mounted) { JV._mounted = true; JV.mountChrome(); } });
})();
