/* =============================================================================
 *  Reviews  (js/reviews.js)  →  powers feedback.html
 *  ---------------------------------------------------------------------------
 *  Public read (anyone can see reviews); submitting requires login. Live mode
 *  reads/writes the `reviews` table; demo mode uses the sample reviews plus any
 *  added locally so the page is fully usable offline.
 * ===========================================================================*/
(function () {
  if (document.body.dataset.page !== 'feedback') return;
  let rating = 0;

  const star = (on, cls = '') => `<svg viewBox="0 0 24 24" class="${on ? 'jv-star-on' : 'jv-star-off'} ${cls}" data-v><path d="M12 2l3 6.5 7 .8-5 4.8 1.3 7L12 17.8 5.4 21l1.3-7-5-4.8 7-.8z" stroke-width="1"/></svg>`;
  const escapeHTML = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const fmtDate = (d) => { try { return new Date(d).toLocaleDateString(JIVANI_CONFIG.LOCALE||'en-IN',{day:'numeric',month:'short',year:'numeric'}); } catch { return ''; } };

  async function loadReviews() {
    let reviews = [];
    if (window.JV_DEMO_MODE || !window.sb) {
      const local = JSON.parse(localStorage.getItem('jv_reviews') || '[]');
      reviews = [...local, ...(window.JV_DEMO.reviews || [])];
    } else {
      try {
        const { data } = await window.sb.from('reviews').select('*, profiles(full_name), products(name)').order('created_at', { ascending: false });
        reviews = (data || []).map(r => ({ ...r, author: r.profiles?.full_name || 'Verified buyer', product_name: r.products?.name }));
      } catch { reviews = []; }
    }

    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
    JV.qs('#fb-summary').innerHTML = reviews.length
      ? `<div class="jv-stars" style="justify-content:center">${Array.from({length:5}).map((_,i)=>star(i<Math.round(avg))).join('')}</div>
         <div class="muted" style="margin-top:8px">${avg.toFixed(1)} average · ${reviews.length} review${reviews.length>1?'s':''}</div>`
      : `<div class="muted">No reviews yet — be the first to share your experience.</div>`;

    JV.qs('#fb-list').innerHTML = reviews.map(r => `
      <div class="jv-card-panel" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div><strong style="font-weight:600">${escapeHTML(r.author || 'Verified buyer')}</strong>
          ${r.product_name ? `<span class="muted" style="font-size:12px"> · on ${escapeHTML(r.product_name)}</span>` : ''}</div>
          <span class="jv-stars">${Array.from({length:5}).map((_,i)=>star(i<r.rating)).join('')}</span>
        </div>
        <p style="color:var(--body)">${escapeHTML(r.review_text)}</p>
        <div class="muted" style="font-size:11px;margin-top:8px">${fmtDate(r.created_at)}</div>
      </div>`).join('');
  }

  async function populateProducts(preselect) {
    const all = await JVProducts.fetchAll();
    JV.qs('#fb-product').innerHTML = `<option value="">General (about the brand)</option>` +
      all.map(p => `<option value="${p.id}" ${p.id === preselect ? 'selected' : ''}>${p.name}</option>`).join('');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    // interactive star picker
    const picker = JV.qs('#fb-stars');
    picker.innerHTML = Array.from({ length: 5 }).map((_, i) => star(false, 'jv-star-input')).join('');
    JV.qsa('svg', picker).forEach((s, i) => {
      s.addEventListener('mouseenter', () => paint(i + 1));
      s.addEventListener('click', () => { rating = i + 1; paint(rating); });
    });
    picker.addEventListener('mouseleave', () => paint(rating));
    function paint(n) { JV.qsa('svg', picker).forEach((s, i) => s.setAttribute('class', (i < n ? 'jv-star-on' : 'jv-star-off') + ' jv-star-input')); }

    const preselect = new URLSearchParams(location.search).get('product');
    await populateProducts(preselect);
    loadReviews();

    JV.qs('#review-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = JV.qs('#fb-text').value.trim();
      const product_id = JV.qs('#fb-product').value || null;
      if (!rating) return JV.toast('Please choose a star rating.', 'error');
      if (text.length < 4) return JV.toast('Please write a short review.', 'error');

      const user = await JVAuth.currentUser();
      if (!user) { JV.toast('Please log in to post a review.', 'info'); setTimeout(() => location.href = 'login.html?next=feedback.html', 900); return; }

      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Posting…';

      try {
        if (window.JV_DEMO_MODE) {
          const profile = await JVAuth.currentProfile();
          const local = JSON.parse(localStorage.getItem('jv_reviews') || '[]');
          local.unshift({ id: 'r' + Date.now(), product_id, author: profile?.full_name || 'You', rating, review_text: text, created_at: new Date().toISOString() });
          localStorage.setItem('jv_reviews', JSON.stringify(local));
        } else {
          const { error } = await window.sb.from('reviews').insert({ user_id: user.id, product_id, rating, review_text: text });
          if (error) throw error;
        }
        JV.qs('#review-form').reset(); rating = 0; paint(0);
        JV.toast('Thank you — your review is live.', 'success');
        loadReviews();
      } catch (err) {
        JV.toast('Could not post your review. Please try again.', 'error');
      } finally { btn.disabled = false; btn.textContent = 'Post review'; }
    });
  });
})();
