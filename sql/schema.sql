-- =============================================================================
--  JIVANI GEMS — Supabase schema (PostgreSQL)
--  ---------------------------------------------------------------------------
--  Run this ENTIRE file once in Supabase → SQL Editor → New query → Run.
--  It is safe to re-run (uses IF NOT EXISTS / idempotent guards).
--
--  Sections:
--    1. Enums
--    2. Tables (products, product_variants, profiles, orders, custom_orders,
--               reviews, wishlist, cart)
--    3. New-user trigger (auto-creates a profile row on signup)
--    4. Row Level Security (RLS) + policies
--    5. Storage buckets + policies
--    6. Seed data (optional sample catalog)
-- =============================================================================

-- gen_random_uuid() lives in pgcrypto (enabled by default on Supabase)
create extension if not exists pgcrypto;

-- ============================== 1. ENUMS ====================================
do $$ begin
  create type product_category as enum
    ('rings','earrings','necklace','choker','pendant_set','anklet','bracelet','loose_diamond');
exception when duplicate_object then null; end $$;

do $$ begin
  create type metal_type as enum ('yellow_gold','rose_gold','white_gold','platinum','silver');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('pending','confirmed','shipped','delivered');
exception when duplicate_object then null; end $$;

do $$ begin
  create type custom_order_status as enum ('submitted','under_review','quoted','confirmed');
exception when duplicate_object then null; end $$;

-- ============================== 2. TABLES ===================================

-- ---- products --------------------------------------------------------------
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text unique,
  category        product_category not null,
  description     text,
  base_price      numeric(12,2),                 -- "from" price (lowest variant)
  images          text[] default '{}',           -- array of Storage public URLs
  is_new_arrival  boolean not null default false,
  popularity      integer not null default 0,    -- drives "most popular" sort
  created_at      timestamptz not null default now()
);

-- ---- product_variants ------------------------------------------------------
create table if not exists public.product_variants (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null references public.products(id) on delete cascade,
  size                text,                       -- ring size / bracelet length (nullable)
  color               text,                       -- diamond colour: D,E,F,G,H,I
  metal               metal_type,
  carat               numeric(6,2),               -- total carat
  num_diamonds        integer,
  cut                 text,
  per_diamond_weight  numeric(6,3),               -- carat per stone
  metal_weight        numeric(7,2),               -- grams
  clarity             text,
  price               numeric(12,2) not null,     -- absolute price for this variant
  stock               text default 'in stock',    -- 'in stock' / 'out of stock'
  created_at          timestamptz not null default now()
);
create index if not exists idx_variants_product on public.product_variants(product_id);

-- ---- profiles (extends auth.users) -----------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text,
  phone             text,
  address           text,
  city              text,
  state             text,
  pincode           text,
  voucher_available boolean not null default false,
  voucher_code      text,
  created_at        timestamptz not null default now()
);

-- ---- orders ----------------------------------------------------------------
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles(id) on delete set null,
  items             jsonb not null,               -- snapshot of purchased items
  subtotal          numeric(12,2) not null,
  tax               numeric(12,2) not null default 0,
  shipping          numeric(12,2) not null default 0,
  discount          numeric(12,2) not null default 0,
  total             numeric(12,2) not null,
  shipping_address  jsonb,
  status              order_status not null default 'confirmed',
  tracking_number     text,
  expected_delivery   date,
  razorpay_order_id   text,                       -- Razorpay order (set when checkout starts)
  razorpay_payment_id text,                       -- Razorpay payment (set when confirmed)
  voucher_code_used   text,
  created_at          timestamptz not null default now()
);
create index if not exists idx_orders_user on public.orders(user_id);

-- Migration (safe no-op on a fresh DB): if you already ran an earlier Stripe
-- version of this schema, rename the old column and add the Razorpay order id.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='stripe_payment_id') then
    alter table public.orders rename column stripe_payment_id to razorpay_payment_id;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='razorpay_order_id') then
    alter table public.orders add column razorpay_order_id text;
  end if;
end $$;

-- ---- custom_orders ---------------------------------------------------------
create table if not exists public.custom_orders (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.profiles(id) on delete set null,
  jewelry_type        text not null,              -- ring, earrings, necklace, …
  carat               numeric(6,2),
  gold_type           text,                       -- yellow_gold, rose_gold, …
  color               text,                       -- D..I
  num_diamonds        integer,
  diamond_type        text,                       -- round brilliant, princess, …
  shape_description   text,
  reference_image_url text,
  contact_email       text,
  status              custom_order_status not null default 'submitted',
  created_at          timestamptz not null default now()
);
create index if not exists idx_custom_user on public.custom_orders(user_id);

-- ---- reviews ---------------------------------------------------------------
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade,
  product_id  uuid references public.products(id) on delete cascade,  -- nullable = general
  rating      integer not null check (rating between 1 and 5),
  review_text text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_reviews_product on public.reviews(product_id);

-- ---- wishlist --------------------------------------------------------------
create table if not exists public.wishlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id, variant_id)
);

-- ---- cart (persists cart across devices for logged-in users) ---------------
create table if not exists public.cart (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  qty        integer not null default 1 check (qty > 0),
  snapshot   jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_cart_user on public.cart(user_id);

-- ===================== 3. NEW-USER TRIGGER ==================================
-- Auto-create a profiles row when someone signs up. full_name/phone come from
-- the metadata we pass in js/auth.js (signUp options.data). SECURITY DEFINER so
-- it can write to profiles regardless of the caller.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===================== 4. ROW LEVEL SECURITY ================================
alter table public.products         enable row level security;
alter table public.product_variants enable row level security;
alter table public.profiles         enable row level security;
alter table public.orders           enable row level security;
alter table public.custom_orders    enable row level security;
alter table public.reviews          enable row level security;
alter table public.wishlist         enable row level security;
alter table public.cart             enable row level security;

-- helper to (re)create a policy idempotently
-- (Postgres lacks "create policy if not exists", so drop-then-create.)

-- products: anyone can read; writes only via service role (dashboard/admin)
drop policy if exists "products read" on public.products;
create policy "products read" on public.products for select using (true);

drop policy if exists "variants read" on public.product_variants;
create policy "variants read" on public.product_variants for select using (true);

-- profiles: a user can see and edit only their own row
drop policy if exists "profile select own" on public.profiles;
create policy "profile select own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profile update own" on public.profiles;
create policy "profile update own" on public.profiles for update using (auth.uid() = id);
drop policy if exists "profile insert own" on public.profiles;
create policy "profile insert own" on public.profiles for insert with check (auth.uid() = id);

-- orders: a user can read only their own orders. Inserts/updates happen from
-- the payment functions using the SERVICE ROLE key, which bypasses RLS — so no
-- insert policy is granted to normal users (they can never forge an order).
drop policy if exists "orders select own" on public.orders;
create policy "orders select own" on public.orders for select using (auth.uid() = user_id);

-- custom_orders: a user can create and read their own
drop policy if exists "custom insert own" on public.custom_orders;
create policy "custom insert own" on public.custom_orders for insert with check (auth.uid() = user_id);
drop policy if exists "custom select own" on public.custom_orders;
create policy "custom select own" on public.custom_orders for select using (auth.uid() = user_id);

-- reviews: everyone can read; logged-in users manage their own
drop policy if exists "reviews read" on public.reviews;
create policy "reviews read" on public.reviews for select using (true);
drop policy if exists "reviews insert own" on public.reviews;
create policy "reviews insert own" on public.reviews for insert with check (auth.uid() = user_id);
drop policy if exists "reviews update own" on public.reviews;
create policy "reviews update own" on public.reviews for update using (auth.uid() = user_id);
drop policy if exists "reviews delete own" on public.reviews;
create policy "reviews delete own" on public.reviews for delete using (auth.uid() = user_id);

-- wishlist: full CRUD on own rows only
drop policy if exists "wishlist all own" on public.wishlist;
create policy "wishlist all own" on public.wishlist for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- cart: full CRUD on own rows only
drop policy if exists "cart all own" on public.cart;
create policy "cart all own" on public.cart for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===================== 5. STORAGE BUCKETS ==================================
-- product-images: public read (so the site can show them), admin writes.
insert into storage.buckets (id, name, public)
  values ('product-images','product-images', true)
  on conflict (id) do nothing;

-- custom-references: customer inspiration uploads. Public read so the team can
-- view them via the stored URL; only authenticated users may upload, into a
-- folder named after their own user id (path = "<uid>/filename").
insert into storage.buckets (id, name, public)
  values ('custom-references','custom-references', true)
  on conflict (id) do nothing;

drop policy if exists "product images public read" on storage.objects;
create policy "product images public read" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "custom refs public read" on storage.objects;
create policy "custom refs public read" on storage.objects
  for select using (bucket_id = 'custom-references');

drop policy if exists "custom refs user upload" on storage.objects;
create policy "custom refs user upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'custom-references' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===================== 6. SEED DATA (optional) =============================
-- A couple of sample products so the live site isn't empty on day one.
-- DELETE this block if you'd rather add everything via the Table Editor.
insert into public.products (id, name, slug, category, description, base_price, images, is_new_arrival, popularity)
values
  ('11111111-1111-1111-1111-111111111111','Aria Solitaire','aria-solitaire','rings',
   'A 1.20ct round brilliant lab-grown solitaire set in 18k recycled gold.', 70320, '{}', true, 98),
  ('22222222-2222-2222-2222-222222222222','Celeste Studs','celeste-studs','earrings',
   'Four-prong martini studs, 1.0ct each — the everyday brilliant.', 64000, '{}', true, 95)
on conflict (id) do nothing;

insert into public.product_variants (product_id, size, color, metal, carat, num_diamonds, cut, per_diamond_weight, metal_weight, clarity, price, stock)
values
  ('11111111-1111-1111-1111-111111111111','6','D','white_gold',1.20,1,'Round Brilliant',1.20,4.0,'VVS2',70320,'in stock'),
  ('11111111-1111-1111-1111-111111111111','7','F','yellow_gold',1.20,1,'Round Brilliant',1.20,4.2,'VS1',67176,'in stock'),
  ('22222222-2222-2222-2222-222222222222',null,'D','white_gold',2.0,2,'Round Brilliant',1.0,2.4,'VVS2',80640,'in stock')
on conflict do nothing;

-- =============================================================================
--  Done. Next: enable Email auth (Authentication → Providers), copy your API
--  keys (Settings → API) into js/config.js and your Netlify env vars, then add
--  real products in the Table Editor + upload images to the product-images
--  bucket. See SETUP-GUIDE.md Steps 2 & 6.
-- =============================================================================
