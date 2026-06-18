/* =============================================================================
 *  Account module  (js/account.js)  →  powers account.html
 *  ---------------------------------------------------------------------------
 *  • greets the user and renders their profile + address (editable)
 *  • lists order history (live `orders` table, or demo orders in localStorage)
 *  • implements the VOUCHER REVEAL: once an order is confirmed the profile has
 *    voucher_available=true + voucher_code → we reveal "You have earned a 50%
 *    off voucher!" with the code. Before that, only the teaser shows (the amount
 *    is never revealed publicly).
 * ===========================================================================*/
(function () {
  const cfg = window.JIVANI_CONFIG || {};
  const DEMO_ORDERS = 'jv_orders';

  async function loadOrders(userId) {
    if (window.JV_DEMO_MODE) { try { return JSON.parse(localStorage.getItem(DEMO_ORDERS)) || []; } catch { return []; } }
    try {
      const { data } = await window.sb.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      return data || [];
    } catch { return []; }
  }

  function fmtDate(d) { try { return new Date(d).toLocaleDateString(cfg.LOCALE || 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return d; } }

  function renderProfile(p) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    set('pf-name', p.full_name); set('pf-email', p.email); set('pf-phone', p.phone);
    set('pf-address', p.address); set('pf-city', p.city); set('pf-state', p.state); set('pf-pincode', p.pincode);
  }

  function renderVoucher(p) {
    const box = document.getElementById('voucher-box');
    if (!box) return;
    if (p.voucher_available && p.voucher_code) {
      box.innerHTML = `
        <div class="jv-voucher-reveal">
          <div style="font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:var(--muted)">Your reward</div>
          <h3 class="serif" style="font-size:28px;margin:10px 0">You’ve earned a ${cfg.VOUCHER_PERCENT || 50}% off voucher!</h3>
          <p class="muted" style="margin-bottom:6px">Apply it at checkout on your next order. Single-use, no expiry.</p>
          <div class="jv-voucher-code">${p.voucher_code}</div>
          <div style="margin-top:18px"><button class="jv-btn jv-btn-sm" id="copy-voucher">Copy code</button></div>
        </div>`;
      const btn = document.getElementById('copy-voucher');
      btn?.addEventListener('click', () => { navigator.clipboard?.writeText(p.voucher_code); JV.toast('Voucher code copied.', 'success'); });
    } else {
      box.innerHTML = `
        <div class="jv-card-panel center">
          <div class="jv-empty" style="padding:30px 10px">
            <div class="mark"></div>
            <h3 style="font-size:24px">A reward awaits</h3>
            <p>Complete an order and a special 50% reward will appear here, ready for your next purchase.</p>
            <a class="jv-btn jv-btn-sm" href="shop.html">Start shopping</a>
          </div>
        </div>`;
    }
  }

  function renderOrders(orders) {
    const wrap = document.getElementById('orders-box');
    if (!wrap) return;
    if (!orders.length) {
      wrap.innerHTML = `<div class="jv-card-panel center muted">No orders yet. <a class="jv-link-underline" href="shop.html" style="border-color:var(--navy)">Browse the collection →</a></div>`;
      return;
    }
    wrap.innerHTML = orders.map(o => {
      const items = Array.isArray(o.items) ? o.items : [];
      const thumbs = items.slice(0, 4).map(i => `<img src="${i.image || ''}" alt="${i.name || ''}" style="width:46px;height:58px;object-fit:cover;background:#EEF0F4">`).join('');
      const status = (o.status || 'confirmed');
      return `
      <div class="jv-card-panel" style="margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:14px;align-items:center;border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:16px">
          <div>
            <div style="font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted)">Order</div>
            <div class="serif" style="font-size:18px">#${String(o.id).slice(0, 8).toUpperCase()}</div>
          </div>
          <div><div class="muted" style="font-size:12px">Placed</div><div>${fmtDate(o.created_at)}</div></div>
          <div><div class="muted" style="font-size:12px">Arrives by</div><div>${o.expected_delivery ? fmtDate(o.expected_delivery) : '—'}</div></div>
          <div><span class="jv-pill ${status}">${status}</span></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
          <div style="display:flex;gap:8px">${thumbs}</div>
          <div style="text-align:right">
            <div class="muted" style="font-size:12px">${items.length} item${items.length>1?'s':''} · Total</div>
            <div class="serif" style="font-size:22px">${JV.money(o.total)}</div>
            ${o.tracking_number ? `<div class="muted" style="font-size:12px;margin-top:4px">Tracking: ${o.tracking_number}</div>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (document.body.dataset.page !== 'account') return;
    const user = await JVAuth.currentUser();
    if (!user) return;                       // auth.js guard will have redirected
    const profile = await JVAuth.currentProfile(true);

    // greeting
    const hi = document.getElementById('acct-greeting');
    if (hi) hi.textContent = profile?.full_name ? `Welcome back, ${profile.full_name.split(' ')[0]}` : 'Your account';

    renderProfile(profile || {});
    renderVoucher(profile || {});
    renderOrders(await loadOrders(user.id));

    // save profile
    const form = document.getElementById('profile-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      const patch = {
        full_name: JV.qs('#pf-name').value.trim(), phone: JV.qs('#pf-phone').value.trim(),
        address: JV.qs('#pf-address').value.trim(), city: JV.qs('#pf-city').value.trim(),
        state: JV.qs('#pf-state').value.trim(), pincode: JV.qs('#pf-pincode').value.trim(),
      };
      btn.disabled = true; btn.textContent = 'Saving…';
      const r = await JVAuth.updateProfile(patch);
      btn.disabled = false; btn.textContent = 'Save changes';
      if (r.ok) { JV.toast('Profile updated.', 'success'); JV.setUser(Object.assign(profile, patch)); }
      else JV.toast(r.message || 'Could not save.', 'error');
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => JVAuth.logout());
  });
})();
