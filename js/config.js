/* =============================================================================
 *  JIVANI GEMS — Front-end configuration
 *  ---------------------------------------------------------------------------
 *  This is the ONE place you edit to wire the site to your accounts.
 *  Everything here is PUBLIC-SAFE (it ships to the browser):
 *    • Supabase URL + anon key  → guarded by Row Level Security
 *    • Razorpay KEY ID           → public-safe (identifies your account)
 *  NEVER put secret keys here (Razorpay key secret, Resend, service-role). Those go in
 *  Netlify environment variables and are used only by netlify/functions/*.
 * ===========================================================================*/

window.JIVANI_CONFIG = {

  /* ---- Supabase (Project → Settings → API) ------------------------------ */
  // CUSTOMIZE: paste your project URL + anon/public key.
  // Leave them as the placeholders to run the site in DEMO MODE (uses the
  // sample catalog in js/data.js, no login/cart persistence). The moment you
  // paste real values, the site switches to live Supabase automatically.
  SUPABASE_URL: 'https://qhdxvybzfmbnbuwwxsog.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoZHh2eWJ6Zm1ibmJ1d3d4c29nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTU1NTYsImV4cCI6MjA5NzE3MTU1Nn0.mlUm9g9UqczfT44jggm44IlVjr35HcaHXp3fbAe_jG8',

  /* ---- Razorpay (Dashboard → Settings → API Keys) ----------------------- */
  // CUSTOMIZE: your Razorpay KEY ID (rzp_test_... while testing, rzp_live_... live).
  // The Key ID is public-safe (like a publishable key) — it identifies your
  // account to the checkout widget. The Key SECRET is NEVER here; it lives only
  // in Netlify env vars (used by the serverless functions to create + verify
  // payments). See SETUP-GUIDE.md Step 3.
  RAZORPAY_KEY_ID: 'rzp_test_T2eg8sLfdlOt1e',

  /* ---- Money & tax ------------------------------------------------------ */
  // ASSUMPTION: India-based store → INR + 18% GST. The homepage reference used
  // "$" placeholders; to switch to USD set CURRENCY:'USD', SYMBOL:'$', LOCALE:'en-US'
  // and (optionally) TAX_RATE to your local rate.
  CURRENCY: 'INR',           // ISO code passed to Razorpay
  CURRENCY_SYMBOL: '₹', // ₹  (use '$' for USD)
  LOCALE: 'en-IN',           // number formatting locale
  TAX_RATE: 0.18,            // 18% GST. CUSTOMIZE for your jurisdiction.
  TAX_LABEL: 'GST (18%)',    // shown in cart/checkout

  /* ---- Shipping (CUSTOMIZE) --------------------------------------------- */
  // Flat fee below the free-shipping threshold; free at/above it.
  SHIPPING_FLAT: 0,          // ₹0 = complimentary shipping (matches the announcement bar)
  FREE_SHIPPING_OVER: 0,     // 0 = always free. e.g. 25000 = free over ₹25,000

  /* ---- Voucher ---------------------------------------------------------- */
  VOUCHER_PERCENT: 50,       // 50% off, single-use, awarded after each completed order

  /* ---- Delivery estimate ------------------------------------------------ */
  DELIVERY_BUSINESS_DAYS: 7, // order date + 7 business days (excludes Sat/Sun)

  /* ---- Brand / SEO ------------------------------------------------------ */
  SITE_NAME: 'Jivani Gems',
  // CUSTOMIZE: your live URL once deployed (used for canonical + OG tags + emails)
  SITE_URL: 'https://jivani-gems.netlify.app',
  CONTACT_EMAIL: 'hello@jivanigems.com',   // CUSTOMIZE
  CONTACT_PHONE: '+91 00000 00000',        // CUSTOMIZE

  /* ---- 360° Hero -------------------------------------------------------- */
  // 'svg'   → on-brand draggable vector ring (works instantly, zero assets)
  // 'photo' → real product spin: drop N frames in assets/hero-360/ and list the
  //           count below. See js/hero360.js header for the exact how-to.
  HERO_MODE: 'svg',
  HERO_PHOTO_FRAME_COUNT: 36,                 // used only when HERO_MODE='photo'
  HERO_PHOTO_PATH: 'assets/hero-360/frame-',  // frames: frame-01.jpg … frame-36.jpg
  HERO_PHOTO_EXT: '.jpg',
};

/* Convenience: true when the keys are still placeholders → run in DEMO MODE. */
window.JIVANI_DEMO_MODE = (
  window.JIVANI_CONFIG.SUPABASE_URL.includes('YOUR-PROJECT') ||
  window.JIVANI_CONFIG.SUPABASE_ANON_KEY.includes('YOUR-ANON')
);
