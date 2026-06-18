# Jivani Gems — Lab-Grown Diamond Jewelry E-Commerce

A production-ready, multi-page e-commerce site built with **HTML + CSS + vanilla JS** on the front end, **Supabase** (Postgres + Auth + Storage) for data, **Razorpay** for payments, **Resend** for email, and **Netlify** for hosting + serverless functions.

> 🟢 **Runs out of the box in DEMO MODE.** Open the site with Live Server and everything works against a sample catalog + `localStorage` — no accounts needed. The moment you paste real keys into `js/config.js`, it switches to live Supabase/Razorpay automatically.

## 📁 Project structure

```
jivani-gems/
├── index.html              # Homepage (360° hero, collections, voucher teaser)
├── shop.html               # Full catalog + filters + sort
├── new-arrivals.html       # Latest pieces (sorted by date)
├── product.html            # Dynamic product page  (product.html?id=…)
├── cart.html               # Cart (qty, GST, shipping)        [login-protected]
├── wishlist.html           # Saved items → move to cart        [login-protected]
├── checkout.html           # Address + voucher + Razorpay      [login-protected]
├── order-success.html      # Confirmation + voucher reveal
├── custom-order.html       # Bespoke request form              [login-protected]
├── contact.html            # Contact form + details
├── feedback.html           # Reviews: submit + display
├── about.html              # Brand story / values / why lab-grown
├── account.html            # Profile, address, orders, vouchers [login-protected]
├── login.html              # Sign in / register
├── 404.html                # On-brand not-found page
│
├── css/
│   └── styles.css          # The whole design system (one file)
│
├── js/
│   ├── config.js           # ⭐ EDIT THIS — your keys + currency/tax/shipping
│   ├── supabaseClient.js   # Supabase init + demo-mode detection
│   ├── data.js             # Demo catalog + pricing rate-card (breakdown popup)
│   ├── ui.js               # Injects navbar/footer everywhere + toasts + helpers
│   ├── auth.js             # Register/login/logout/profile + route guards
│   ├── cart.js             # Cart state (localStorage + Supabase mirror)
│   ├── wishlist.js         # Wishlist state
│   ├── products.js         # Fetch + render product cards/grids
│   ├── hero360.js          # Draggable 360° hero (SVG or photo-frame mode)
│   ├── shop.js             # Shop filters + sort
│   ├── product-detail.js   # Product page (variants, live price, breakdown, reviews)
│   ├── account.js          # Account page (orders, voucher reveal)
│   ├── checkout.js         # Checkout flow + Razorpay widget handoff
│   ├── custom-order.js     # Custom order form
│   └── reviews.js          # Feedback page
│
├── netlify/functions/      # Serverless (Node) — secrets live here, never client
│   ├── _shared.js          # Supabase service client, Resend, email templates
│   ├── create-razorpay-order.js     # Re-prices cart, validates voucher, → Razorpay
│   ├── verify-razorpay-payment.js   # Verifies signature, confirms order, awards voucher, emails receipt
│   ├── razorpay-webhook.js # Backup confirmation if the buyer closes the tab
│   └── send-email.js       # Welcome / custom-order / contact emails
│
├── sql/schema.sql          # Run once in Supabase SQL editor (tables + RLS + seed)
├── netlify.toml            # Hosting config, clean URLs, function settings
├── package.json            # Function dependencies (Razorpay, Supabase, Resend)
├── .env.example            # Copy to .env — server secrets for `netlify dev`
├── sitemap.xml / robots.txt
└── SETUP-GUIDE.md          # 👉 Full step-by-step launch guide (read this!)
```

## 🚀 Quick start (local preview, demo mode)

1. Open the folder in **VS Code**.
2. Install the **Live Server** extension.
3. Right-click `index.html` → **Open with Live Server**.
4. Click around — register a demo account, add to cart, check out, watch the voucher appear.

## 🔑 Go live

Follow **[SETUP-GUIDE.md](SETUP-GUIDE.md)** — it walks you through Supabase, Razorpay, Resend, GitHub, Netlify, custom domain, and adding products, step by numbered step.

## ⚙️ Where to customize (search the code for `CUSTOMIZE:`)

| What | File |
|------|------|
| API keys (public) | `js/config.js` |
| Currency / GST rate / shipping | `js/config.js` |
| Pricing rate-card (breakdown popup) | `js/data.js` → `JV_PRICING` |
| Server secrets | Netlify env vars (see `.env.example`) |
| 360° hero image | `js/config.js` → `HERO_MODE` (see `js/hero360.js` header) |
| Contact details / social links | `js/config.js` + `js/ui.js` footer |

**Assumptions made (all changeable in `js/config.js`):** currency **INR ₹**, tax **18% GST**, shipping **complimentary**, voucher **50% single-use**, delivery **order + 7 business days**.
