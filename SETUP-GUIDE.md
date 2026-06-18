# Jivani Gems — Part 2: Step-by-Step Setup & Launch Guide

This guide takes you from the files on your computer to a live, payment-accepting website. Work through the steps **in order**. Each step is self-contained and tells you exactly what to click and where to paste things.

> **Mental model:** the site is *static files* (HTML/CSS/JS) that talk to *Supabase* (your database + logins + image storage) and to *Netlify Functions* (tiny server scripts that handle Razorpay payments and emails, because those need secret keys the browser must never see).

**Two kinds of keys — this trips everyone up, so read once:**
- **Public keys** (Supabase URL + `anon` key, Razorpay **Key Id**) → go in `js/config.js`. Safe in the browser; protected by database rules + server-side signature checks.
- **Secret keys** (Razorpay **Key Secret**, Razorpay webhook secret, Resend key, Supabase **service-role** key) → go in **Netlify environment variables** only. Never in `js/config.js`, never committed to GitHub.

---

## Step 1 — Project Setup (local + VS Code)

### 1.1 Put the folder somewhere sensible
Create a folder, e.g. `C:\Users\you\Projects\jivani-gems`, and place all the project files inside it (you already have them).

### 1.2 Open it in VS Code
- Open **VS Code** → **File → Open Folder…** → choose the `jivani-gems` folder.

### 1.3 Install VS Code extensions
Click the Extensions icon (left bar) and install:
| Extension | Why |
|-----------|-----|
| **Live Server** (Ritwick Dey) | One-click local preview with auto-reload |
| **Prettier** | Auto-format HTML/CSS/JS on save |
| **ESLint** *(optional)* | Catches JS mistakes as you type |
| **DotENV** *(optional)* | Syntax-highlights your `.env` file |

### 1.4 Preview it right now (demo mode)
Right-click `index.html` → **Open with Live Server**. The site opens at `http://127.0.0.1:5500`. Everything works against the built-in sample catalog. 🎉

### 1.5 What each folder/file does
See the table in **README.md** — it lists every file with a one-line purpose. The three you'll actually edit are:
- `js/config.js` — your keys + currency/tax settings (Step 2 & 3).
- `sql/schema.sql` — you'll paste this into Supabase once (Step 2).
- Netlify env vars — your secret keys (Step 3, 4, 5).

### 1.6 The launch path (you'll do these in Steps 2–5)
```
Local files → GitHub repo → Netlify (hosting + functions) → live URL → custom domain
                 ▲                         ▲
            Supabase keys            Razorpay + Resend secrets
            in config.js             in Netlify env vars
```

---

## Step 2 — Supabase Setup (database, auth, storage)

### 2.1 Create the project
1. Go to **https://supabase.com** → **Sign in** (GitHub login is easiest) → **New project**.
2. Name it `jivani-gems`, set a strong **database password** (save it somewhere), pick the **region** closest to your customers (e.g. *Mumbai / South Asia* for India).
3. Wait ~2 minutes for it to provision.

### 2.2 Create all the tables (run the SQL)
1. Left sidebar → **SQL Editor** → **+ New query**.
2. Open `sql/schema.sql` from the project, **copy the entire file**, paste it into the editor.
3. Click **Run** (or Ctrl/Cmd+Enter). You should see *"Success. No rows returned."*

This single script creates every table (`products`, `product_variants`, `profiles`, `orders`, `custom_orders`, `reviews`, `wishlist`, `cart`), all the enums, **enables Row Level Security with the right policies**, sets up the **auto-create-profile trigger**, creates the **storage buckets**, and inserts **2 sample products**. It's safe to re-run.

### 2.3 What Row Level Security (RLS) is doing (already set by the script)
RLS means *"each logged-in user can only touch their own rows."* The script already created these policies — you don't need to add anything, but here's what they enforce:
| Table | Who can read | Who can write |
|-------|--------------|---------------|
| products / product_variants | **everyone** | only you (dashboard / service-role) |
| profiles | only **your own** row | only your own row |
| orders | only **your own** orders | only the server (webhook, service-role) — users can't forge orders |
| custom_orders | only your own | create your own |
| reviews | **everyone** | logged-in users create/edit their own |
| wishlist / cart | only your own | only your own |

> To confirm: **Authentication → Policies** — you'll see the named policies on each table.

### 2.4 Turn on Email auth
1. **Authentication → Providers → Email** → make sure **Enable Email provider** is ON.
2. **For easy testing:** **Authentication → Providers → Email →** turn **"Confirm email" OFF** while developing, so new accounts can log in immediately. Turn it **back ON before launch** (Step 7) so real users verify their address.
3. *(Optional)* **Authentication → URL Configuration →** set **Site URL** to your Netlify URL once you have it (Step 5).

### 2.5 Storage buckets (already created by the script)
The SQL created two buckets under **Storage**:
- **`product-images`** — public; this is where you upload product photos.
- **`custom-references`** — customers' inspiration uploads from the custom-order form.

If they're not visible, the script's storage section ran — refresh the **Storage** page.

### 2.6 Get your API keys → put the PUBLIC ones in config.js
1. **Project Settings (gear) → API**.
2. Copy:
   - **Project URL** → looks like `https://abcdxyz.supabase.co`
   - **`anon` `public` key** → a long `eyJ…` string
   - **`service_role` key** → another long string — **SECRET**, for Netlify only (Step 5), *not* config.js.
3. Open `js/config.js` and paste the first two:
   ```js
   SUPABASE_URL: 'https://abcdxyz.supabase.co',      // ← your Project URL
   SUPABASE_ANON_KEY: 'eyJhbGciOi...your-anon-key',  // ← your anon public key
   ```
4. Save. Reload the site with Live Server — the console no longer says "DEMO MODE", and the site now reads/writes your real database. (Your 2 seed products appear; add more in Step 6.)

---

## Step 3 — Razorpay Setup (payments)

> **Why Razorpay (not Stripe)?** Razorpay is built for India: it accepts **UPI, cards, net-banking and wallets** in INR, and jewellery is a supported category. Stripe lists jewellery/precious stones as *restricted* (needs approval) and its domestic India support is limited — so Razorpay is the right call for this store.
>
> **How the flow works (different from Stripe):** instead of redirecting to a hosted page, Razorpay opens a **popup widget** on your own checkout page. After payment, your server **verifies a signature** to prove it's real. Three functions do this: `create-razorpay-order` (starts it), `verify-razorpay-payment` (confirms it), and `razorpay-webhook` (a backup if the buyer closes the tab).

### 3.1 Create the account + get TEST keys
1. **https://razorpay.com** → **Sign Up** (you can explore Test mode immediately; full KYC is only needed to go *live*).
2. Make sure the dashboard mode toggle (top of the left sidebar) says **Test Mode**.
3. **Settings → API Keys → Generate Test Key**. A dialog shows:
   - **Key Id** `rzp_test_…` → goes in `js/config.js` → `RAZORPAY_KEY_ID` **and** Netlify env `RAZORPAY_KEY_ID`. (Public — it's fine in the browser.)
   - **Key Secret** → **SECRET**, Netlify env var `RAZORPAY_KEY_SECRET` only (Step 5). **Copy it now — it's shown only once.**

### 3.2 Do you need to create products in Razorpay? **No.**
This site creates the payment **amount dynamically** from your database at checkout (`create-razorpay-order.js` re-prices the cart and creates a Razorpay *Order* for the exact total). You manage products only in Supabase (Step 6). ✅

### 3.3 Set up the webhook (backup confirmation)
The browser already verifies the payment immediately (`verify-razorpay-payment`). The webhook is a **safety net** so an order still confirms if the buyer closes the tab right after paying.

1. **Settings → Webhooks → + Create New Webhook**.
2. **Webhook URL:** `https://YOUR-SITE.netlify.app/.netlify/functions/razorpay-webhook`
   *(you'll have this URL after Step 5 — come back and add it then.)*
3. **Secret:** type any strong string you choose — copy the **same value** into Netlify env `RAZORPAY_WEBHOOK_SECRET` (Step 5).
4. **Active Events:** tick **`payment.captured`** (and optionally **`order.paid`**).
5. **Create Webhook.**

### 3.4 Test payments with Razorpay's test methods
In Test Mode the widget accepts these (no real money moves):
| Method | What to enter |
|--------|---------------|
| 💳 Card (success) | `4111 1111 1111 1111` · any future expiry · any CVV · any name |
| 🔐 Card OTP step | on the test OTP screen click **Success** (or enter `1234` if asked) |
| 📲 UPI (success) | UPI ID `success@razorpay` |
| 📲 UPI (failure) | UPI ID `failure@razorpay` |
| 🏦 Net-banking | pick any bank → choose **Success** on the test page |

After a successful test payment you should see: the popup closes → redirect to the success page → the order in **Supabase → Table editor → orders** flips from `pending` to `confirmed` → a voucher appears on your profile → (if email is set up) a receipt arrives.

### 3.5 Switch to LIVE when launching (Step 7)
Complete Razorpay **KYC / business verification** (Settings → Account & Settings → needs your business details + bank account; jewellery sellers may get a quick extra review). Then switch the dashboard to **Live Mode**, **Settings → API Keys → Generate Live Key** (`rzp_live_…` + live secret), create a **new live webhook** (same URL + events) with its own secret, and update: `RAZORPAY_KEY_ID` in `config.js` + Netlify, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` in Netlify. See Step 7.

---

## Step 4 — Email Setup (Resend)

We use **Resend** (clean API, generous free tier). Order receipts, the welcome email, and custom-order confirmations all flow through it.

### 4.1 Create the account + API key
1. **https://resend.com** → sign up.
2. **API Keys → Create API Key** → copy `re_…` → **SECRET**, Netlify env var `RESEND_API_KEY` (Step 5).

### 4.2 Verify a sending domain (recommended) — or test instantly
- **Instant testing:** Resend gives you `onboarding@resend.dev` — emails work immediately to **your own** address. The functions already default to this, so you can test today.
- **For real customers:** **Domains → Add Domain** → add your domain (e.g. `jivanigems.com`) → add the **DNS records** Resend shows (TXT/MX/DKIM) at your domain registrar → wait for "Verified". Then set the Netlify env var:
  ```
  ORDER_FROM_EMAIL = Jivani Gems <orders@jivanigems.com>
  ```

### 4.3 How it's wired (already done in code)
- **Welcome email** → `js/auth.js` calls `send-email` on signup ("Your account has been created successfully…").
- **Custom-order confirmation** → `js/custom-order.js` ("…we'll reach out within 3 business days…").
- **Order receipt** → sent automatically right after payment is verified (`verify-razorpay-payment.js`, with `razorpay-webhook.js` as backup) — itemized, with totals, address, delivery date, track link, and the voucher reveal.
- **Contact form** → optionally notifies you if you set `CONTACT_INBOX` env var.

### 4.4 Test the email flow
With keys set and running on Netlify (Step 5): register a new account → check your inbox for the welcome email. Place a test order → check for the receipt.

---

## Step 5 — GitHub & Netlify Deployment

### 5.1 Put the code on GitHub
In VS Code's terminal (**Terminal → New Terminal**), inside the project folder:
```bash
git init
git add .
git commit -m "Initial commit — Jivani Gems"
```
Then create an **empty** repo on **github.com** (no README), and run the two lines GitHub shows you:
```bash
git remote add origin https://github.com/YOUR-USERNAME/jivani-gems.git
git branch -M main
git push -u origin main
```
> `.env` is git-ignored, so your secrets are **not** pushed. Good.

### 5.2 Connect the repo to Netlify
1. **https://netlify.com** → sign up (GitHub login).
2. **Add new site → Import an existing project → GitHub** → pick `jivani-gems`.
3. Build settings — leave as detected (the included `netlify.toml` already sets: publish `.`, functions `netlify/functions`). Click **Deploy**.
4. After ~1 minute you get a URL like `https://jivani-gems-1234.netlify.app`.

### 5.3 Set environment variables (the secrets)
**Site configuration → Environment variables → Add a variable** (add each):
| Key | Value |
|-----|-------|
| `SUPABASE_URL` | your Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | the **service_role** key (secret) |
| `RAZORPAY_KEY_ID` | `rzp_test_…` (then `rzp_live_…` at launch) — same value as in config.js |
| `RAZORPAY_KEY_SECRET` | the Key Secret from Step 3.1 (then the live secret at launch) |
| `RAZORPAY_WEBHOOK_SECRET` | the secret you set on the webhook in Step 3.3 |
| `RESEND_API_KEY` | `re_…` |
| `ORDER_FROM_EMAIL` | `Jivani Gems <orders@your-domain>` (or leave for resend.dev) |
| `SITE_URL` | your Netlify URL, no trailing slash |
| `CONTACT_INBOX` *(optional)* | where contact-form enquiries go |

> Currency/tax overrides (`TAX_RATE`, `CURRENCY`, etc.) can also be set here if you want the *emails/server* to match a non-default currency — otherwise they default to INR/18%.

After adding variables, **Deploys → Trigger deploy → Deploy site** so the functions pick them up.

### 5.4 Add the Netlify URL back into Razorpay + Supabase
- **Razorpay** webhook URL (Step 3.3) → `https://YOUR-SITE.netlify.app/.netlify/functions/razorpay-webhook`.
- **Supabase → Authentication → URL Configuration → Site URL** → your Netlify URL.

### 5.5 Clean URLs / routing
Already handled by `netlify.toml`: `/shop` serves `shop.html`, unknown paths show the custom `404.html`, and `/.netlify/functions/*` routes to your functions. Nothing to do.

### 5.6 Free subdomain → custom domain
- **Free:** **Site configuration → Change site name** → e.g. `jivanigems` → `https://jivanigems.netlify.app`.
- **Custom domain (e.g. from GoDaddy/Namecheap):**
  1. **Domain management → Add a domain** → type `jivanigems.com` → **Verify** → **Add**.
  2. Netlify shows DNS targets. At your registrar's DNS settings:
     - **Apex** `jivanigems.com`: add an **A record** → `75.2.60.5` (Netlify's load balancer) **or** follow Netlify's "use Netlify DNS" option.
     - **www**: add a **CNAME** → `YOUR-SITE.netlify.app`.
  3. Wait for DNS to propagate (minutes–hours). Netlify auto-provisions a free **HTTPS** certificate.
  4. Update `SITE_URL` env var + `js/config.js` `SITE_URL` + the `<link rel="canonical">`/sitemap URLs to the new domain, then redeploy.

---

## Step 6 — Adding Products

Your catalog is **100% database-driven** — **you never touch code to add products.** Add rows in Supabase and they appear on the site instantly.

### 6.1 Add a product (Supabase Table Editor)
1. **Table editor → `products` → Insert → Insert row**.
2. Fill in:
   - `name` — e.g. *"Aurelia Halo Ring"*
   - `slug` — e.g. *"aurelia-halo-ring"* (lowercase-with-dashes; used in nice URLs)
   - `category` — pick one: `rings, earrings, necklace, choker, pendant_set, anklet, bracelet, loose_diamond`
   - `description` — the marketing copy
   - `base_price` — the "from" price shown on cards (or leave blank to auto-use the lowest variant)
   - `is_new_arrival` — `true` to feature it on New Arrivals
   - `popularity` — a number (higher = sorts first under "Most popular")
   - `images` — leave empty for now; fill after 6.3
3. **Save**. Copy the new row's **`id`** (a UUID) — you need it for variants.

### 6.2 Add variants (sizes / metals / diamond specs + price)
1. **Table editor → `product_variants` → Insert row**.
2. `product_id` = the product UUID from 6.1. Then `size`, `color` (D–I), `metal` (`yellow_gold`…), `carat`, `num_diamonds`, `cut`, `per_diamond_weight`, `metal_weight`, `clarity`, **`price`** (this exact variant's price), `stock` (`in stock` / `out of stock`).
3. Add one row **per variant** (e.g. each ring size or metal). The product page builds its dropdowns and the **price-breakdown popup** from these fields automatically.

### 6.3 Upload product images → link them
1. **Storage → `product-images` → Upload file(s)** (3–4 photos per product for the hover slideshow looks best).
2. Click an uploaded file → **Copy URL** (it's a public URL like `https://…/storage/v1/object/public/product-images/ring1.jpg`).
3. Back in **`products`**, edit your row's **`images`** column. It's an array — enter it like:
   ```
   ["https://…/ring1.jpg","https://…/ring2.jpg","https://…/ring3.jpg"]
   ```
   The **first** image is the card thumbnail; the rest cycle on hover and fill the product gallery.
4. Reload the site — the product is live with photos. **No code changes needed.**

### 6.4 Do I ever need to change code? 
**No** for products, variants, prices, images, stock, new-arrival flags, categories — all database-driven. You'd only touch code to change the *pricing rate-card* used by the breakdown popup (`js/data.js → JV_PRICING`) or to add a brand-new category enum value (in `sql/schema.sql`).

---

## Step 7 — Going Live Checklist

Work top to bottom the day you launch:

- [ ] **Razorpay → Live mode** (after KYC). Replace test keys with live ones:
  - `js/config.js` → `RAZORPAY_KEY_ID = rzp_live_…`
  - Netlify env → `RAZORPAY_KEY_ID = rzp_live_…` and `RAZORPAY_KEY_SECRET = <live secret>`
  - Create a **new live webhook** (same URL, event `payment.captured`) → put its secret in Netlify `RAZORPAY_WEBHOOK_SECRET`.
- [ ] **Custom domain** connected with HTTPS working (Step 5.6).
- [ ] **All env vars are production values** (Supabase, Razorpay live, Resend, `SITE_URL` = real domain). Redeploy after changes.
- [ ] **Update URLs** in `js/config.js` (`SITE_URL`), every page's `<link rel="canonical">`, `sitemap.xml`, `robots.txt`, and the `og:*` tags to the real domain.
- [ ] **Supabase:** turn **"Confirm email" back ON**; set **Auth → Site URL** to the real domain.
- [ ] **Full purchase test end-to-end** on the live domain (a small real payment, or a final test in test mode) → order appears `confirmed`, receipt email arrives, voucher awarded.
- [ ] **Mobile check** — open the live site on a phone (or DevTools device mode): nav drawer, hero drag, grids, checkout.
- [ ] **Emails verified** — welcome, custom-order, and order-receipt all arriving (check spam; verify your Resend domain to avoid it).
- [ ] **SEO / Search Console:** go to **https://search.google.com/search-console**, add your domain (verify via DNS TXT), then **Sitemaps → submit** `https://your-domain/sitemap.xml`.
- [ ] **Add a real OG image** at `assets/og-image.jpg` (1200×630) so shared links look good.

---

## Swapping the 360° hero ring (do this whenever you launch a new ring)

The hero supports two modes — set in `js/config.js`:

**Default — `HERO_MODE: 'svg'`:** an on-brand vector ring that spins. Zero images. Works instantly.

**Real photos — `HERO_MODE: 'photo'`:** a true product spin from a turntable sequence:
1. Photograph the ring on a rotating stand, **~36 shots, one every 10°**, consistent lighting/centre.
2. Name them `frame-01.jpg`, `frame-02.jpg`, … `frame-36.jpg`.
3. Drop them into **`assets/hero-360/`**.
4. In `js/config.js`: `HERO_MODE: 'photo'` (and `HERO_PHOTO_FRAME_COUNT` if not 36).
5. Done — dragging now scrubs your real photos. **To launch a new ring later, just replace those 36 images (same names).** No code changes; the drag behaviour stays identical.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Console says "DEMO MODE" after adding keys | Re-check `SUPABASE_URL` / `SUPABASE_ANON_KEY` in `js/config.js` — a placeholder remains. |
| Login works but cart/orders don't persist | RLS or keys — confirm `schema.sql` ran fully and keys are correct. |
| Pay button spins but no popup appears | The Razorpay script didn't load — confirm `https://checkout.razorpay.com/v1/checkout.js` is in `checkout.html` and `RAZORPAY_KEY_ID` is set in `js/config.js`. |
| Payment succeeds but order stays `pending` | The verify call or webhook failed — check **Netlify → Functions → `verify-razorpay-payment` / `razorpay-webhook` → logs**. Confirm `RAZORPAY_KEY_SECRET` (verify) and `RAZORPAY_WEBHOOK_SECRET` (webhook) match the dashboard. |
| No emails | `RESEND_API_KEY` set? Sending from a verified domain (or `resend.dev` to your own inbox)? Check Netlify function logs. |
| Function 500 errors | **Netlify → Functions → logs** (e.g. `create-razorpay-order`) — the cause is printed there. Usually a missing env var. |
| Images broken on a product | The `images` column must be a JSON array of **public** Storage URLs; first item is the thumbnail. |

---

### Assumptions (change in `js/config.js`)
Currency **INR ₹** · Tax **18% GST** · Shipping **complimentary** · Voucher **50%, single-use, no expiry** · Delivery **order date + 7 business days**. The homepage reference used `$` placeholders; this build defaults to ₹ because GST + pincode imply India — flip `CURRENCY`/`CURRENCY_SYMBOL`/`LOCALE` to go back to USD.

🤖 Built with care. Questions? Re-read the relevant step — the answer is almost always a key in the wrong place.
