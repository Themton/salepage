-- ═══════════════════════════════════════════
-- Supabase Schema: SalePage System
-- Prefix: sp_ (กันซ้ำกับตารางอื่น)
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════

-- 1) Pages table — each salepage
create table sp_pages (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,
  name text not null default 'สินค้าใหม่',
  settings jsonb not null default '{}',
  is_active boolean default true,
  pixel_id text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2) Orders table
create table sp_orders (
  id uuid default gen_random_uuid() primary key,
  page_id uuid references sp_pages(id) on delete cascade,
  customer_name text not null,
  customer_tel text not null,
  customer_addr text not null,
  package_name text,
  total numeric default 0,
  status text default 'pending' check (status in ('pending','shipped','done','cancel')),
  meta jsonb default '{}',
  created_at timestamptz default now()
);

-- 3) Events table — Meta Pixel tracking
create table sp_events (
  id uuid default gen_random_uuid() primary key,
  page_id uuid references sp_pages(id) on delete cascade,
  event_name text not null,
  event_data jsonb default '{}',
  created_at timestamptz default now()
);

-- 4) Customers table (imported from CSV)
create table sp_customers (
  id uuid default gen_random_uuid() primary key,
  page_id uuid references sp_pages(id) on delete cascade,
  data jsonb not null default '{}',
  created_at timestamptz default now()
);

-- Indexes
create index idx_sp_orders_page on sp_orders(page_id);
create index idx_sp_orders_status on sp_orders(status);
create index idx_sp_events_page on sp_events(page_id);
create index idx_sp_events_name on sp_events(event_name);
create index idx_sp_pages_slug on sp_pages(slug);

-- RLS (Row Level Security)
alter table sp_pages enable row level security;
alter table sp_orders enable row level security;
alter table sp_events enable row level security;
alter table sp_customers enable row level security;

-- Allow anon read for pages (public salepages)
create policy "Public read active sp_pages" on sp_pages for select using (is_active = true);
-- Allow anon insert for orders & events
create policy "Public insert sp_orders" on sp_orders for insert with check (true);
create policy "Public insert sp_events" on sp_events for insert with check (true);
-- Allow all for authenticated (admin)
create policy "Admin all sp_pages" on sp_pages for all using (true);
create policy "Admin all sp_orders" on sp_orders for all using (true);
create policy "Admin all sp_events" on sp_events for all using (true);
create policy "Admin all sp_customers" on sp_customers for all using (true);
