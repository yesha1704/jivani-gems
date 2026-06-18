/* =============================================================================
 *  Auth module  (js/auth.js)  →  window.JVAuth
 *  ---------------------------------------------------------------------------
 *  Wraps Supabase Auth (email + password) and the extended `profiles` table.
 *  Responsibilities:
 *    • resolve the session on every page → greet the user, swap account links,
 *      pull their cart/wishlist from the server
 *    • register / login / logout / update profile
 *    • route-guard protected pages (cart, wishlist, checkout, custom order,
 *      account) → bounce to login.html?next=… when logged out
 *    • fire the custom "account created" welcome email on sign-up
 *
 *  DEMO MODE: with placeholder keys, a fake local account (localStorage) lets
 *  you preview every logged-in screen with no backend. Email: demo@jivani.test
 * ===========================================================================*/
(function () {
  const cfg = window.JIVANI_CONFIG || {};
  const PROTECTED = ['cart', 'wishlist', 'checkout', 'custom', 'account'];
  let _profile = null;

  /* ----------------------------- DEMO auth ------------------------------ */
  const DEMO_KEY = 'jv_demo_user';
  const demoUser = () => { try { return JSON.parse(localStorage.getItem(DEMO_KEY)); } catch { return null; } };
  const setDemoUser = (u) => { if (u) localStorage.setItem(DEMO_KEY, JSON.stringify(u)); else localStorage.removeItem(DEMO_KEY); };

  /* --------------------------- welcome email ---------------------------- */
  // Fire-and-forget. Calls our Netlify function; silently ignored in demo/local.
  async function sendWelcomeEmail(to, name) {
    if (window.JV_DEMO_MODE) return;
    try {
      await fetch('/.netlify/functions/send-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'welcome', to, name }),
      });
    } catch (_) { /* non-fatal */ }
  }

  const JVAuth = window.JVAuth = {
    /* ---- session ---- */
    async currentUser() {
      if (window.JV_DEMO_MODE) { const u = demoUser(); return u ? { id: u.id, email: u.email } : null; }
      try { const { data: { user } } = await window.sb.auth.getUser(); return user; } catch { return null; }
    },

    async currentProfile(force = false) {
      if (_profile && !force) return _profile;
      if (window.JV_DEMO_MODE) { _profile = demoUser(); return _profile; }
      const user = await this.currentUser();
      if (!user) return null;
      try {
        const { data } = await window.sb.from('profiles').select('*').eq('id', user.id).single();
        _profile = data ? Object.assign({ email: user.email }, data) : { id: user.id, email: user.email };
        return _profile;
      } catch { _profile = { id: user.id, email: user.email }; return _profile; }
    },

    /* ---- register ---- */
    async register({ email, password, full_name, phone }) {
      if (window.JV_DEMO_MODE) {
        const u = { id: 'demo-' + Date.now(), email, full_name, phone: phone || '', address: '', city: '', state: '', pincode: '', voucher_available: false, voucher_code: null };
        setDemoUser(u); _profile = u; await afterLogin();
        return { ok: true, message: 'Account created! (demo mode)' };
      }
      try {
        // full_name/phone go into user metadata so the DB trigger can seed the
        // profiles row even before email confirmation completes.
        const { data, error } = await window.sb.auth.signUp({
          email, password,
          options: { data: { full_name, phone: phone || '' }, emailRedirectTo: cfg.SITE_URL + '/account.html' },
        });
        if (error) throw error;
        sendWelcomeEmail(email, full_name);
        // If confirmation is required there is no session yet.
        if (!data.session) return { ok: true, needsConfirm: true, message: 'Account created — check your email to confirm, then log in.' };
        await afterLogin();
        return { ok: true, message: 'Welcome to Jivani Gems!' };
      } catch (e) {
        return { ok: false, message: friendly(e) };
      }
    },

    /* ---- login ---- */
    async login(email, password) {
      if (window.JV_DEMO_MODE) {
        let u = demoUser();
        if (!u || u.email !== email) u = { id: 'demo-' + Date.now(), email, full_name: email.split('@')[0], phone:'', address:'', city:'', state:'', pincode:'', voucher_available:false, voucher_code:null };
        setDemoUser(u); _profile = u; await afterLogin();
        return { ok: true };
      }
      try {
        const { error } = await window.sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await afterLogin();
        return { ok: true };
      } catch (e) { return { ok: false, message: friendly(e) }; }
    },

    /* ---- logout ---- */
    async logout() {
      if (window.JV_DEMO_MODE) { setDemoUser(null); }
      else { try { await window.sb.auth.signOut(); } catch (_) {} }
      _profile = null;
      if (window.JV) JV.setUser(null);
      location.href = 'index.html';
    },

    /* ---- update profile ---- */
    async updateProfile(patch) {
      if (window.JV_DEMO_MODE) { const u = Object.assign(demoUser() || {}, patch); setDemoUser(u); _profile = u; return { ok: true }; }
      try {
        const user = await this.currentUser();
        const { error } = await window.sb.from('profiles').update(patch).eq('id', user.id);
        if (error) throw error;
        _profile = Object.assign(_profile || {}, patch);
        return { ok: true };
      } catch (e) { return { ok: false, message: friendly(e) }; }
    },

    /* ---- guard a protected page ---- */
    async requireAuth() {
      const user = await this.currentUser();
      if (!user) {
        const next = encodeURIComponent(location.pathname.split('/').pop() + location.search);
        location.href = `login.html?next=${next}`;
        return false;
      }
      return true;
    },
  };

  /* --------------------------- helpers ---------------------------------- */
  // Turn raw auth errors into friendly copy (never expose internals).
  function friendly(e) {
    const m = (e && e.message || '').toLowerCase();
    if (m.includes('invalid login')) return 'Email or password is incorrect.';
    if (m.includes('already registered') || m.includes('already exists')) return 'An account with this email already exists. Try logging in.';
    if (m.includes('password')) return 'Password must be at least 6 characters.';
    if (m.includes('email')) return 'Please enter a valid email address.';
    return 'Something went wrong. Please try again.';
  }

  async function afterLogin() {
    const profile = await JVAuth.currentProfile(true);
    if (window.JV) JV.setUser(profile);
    if (window.JVCart && JVCart.syncFromServer) JVCart.syncFromServer();
    if (window.JVWishlist && JVWishlist.syncFromServer) JVWishlist.syncFromServer();
  }

  /* --------------------------- on every page ---------------------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    // route-guard
    const page = document.body.dataset.page;
    if (PROTECTED.includes(page)) { const ok = await JVAuth.requireAuth(); if (!ok) return; }

    // greet + sync
    const profile = await JVAuth.currentProfile();
    if (window.JV) JV.setUser(profile);
    if (profile) {
      if (window.JVCart && JVCart.syncFromServer) JVCart.syncFromServer();
      if (window.JVWishlist && JVWishlist.syncFromServer) JVWishlist.syncFromServer();
    }

    // react to auth changes in real Supabase (e.g. token refresh, other tabs)
    if (!window.JV_DEMO_MODE && window.sb) {
      window.sb.auth.onAuthStateChange((_evt, session) => { if (!session) { _profile = null; if (window.JV) JV.setUser(null); } });
    }
  });
})();
