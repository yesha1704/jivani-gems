/* =============================================================================
 *  Supabase client bootstrap  (js/supabaseClient.js)
 *  ---------------------------------------------------------------------------
 *  Requires the supabase-js UMD bundle to be loaded first (we add it via a
 *  <script> tag in each page's <head>):
 *    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *
 *  Exposes:
 *    window.sb            → the Supabase client (or null in DEMO MODE)
 *    window.JV_DEMO_MODE  → boolean, true when keys are placeholders
 *
 *  In DEMO MODE the rest of the app falls back to the sample catalog in
 *  js/data.js and uses localStorage for cart/wishlist so you can click around
 *  before wiring up the database.
 * ===========================================================================*/
(function () {
  const cfg = window.JIVANI_CONFIG || {};
  const demo = window.JIVANI_DEMO_MODE;

  window.JV_DEMO_MODE = demo;

  if (demo) {
    console.info(
      '%c[Jivani Gems] DEMO MODE','color:#0F1B3D;font-weight:bold',
      '\nUsing the sample catalog + localStorage. Paste your Supabase keys in js/config.js to go live.'
    );
    window.sb = null;
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    console.error('[Jivani Gems] supabase-js failed to load. Check the CDN <script> in your page <head>.');
    window.sb = null;
    return;
  }

  // Create the singleton client. persistSession keeps the user logged in across
  // refreshes (stored in localStorage by default) — satisfies the "keep account
  // state across page refreshes" requirement.
  window.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
})();
