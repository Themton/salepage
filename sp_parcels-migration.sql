-- ═══════════════════════════════════════════
-- sp_parcels — Flash Express Integration
-- Run in Supabase SQL Editor (fnkohtdpwdwedjrtklre)
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sp_parcels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES sp_orders(id) ON DELETE SET NULL,
  page_id UUID REFERENCES sp_pages(id) ON DELETE SET NULL,
  parcel_no TEXT NOT NULL UNIQUE,                 -- SP-260408-0001
  flash_pno TEXT,                                  -- TH01xxxxx (from Flash API)
  flash_sort_code TEXT,                            -- sorting code
  flash_dst_store TEXT,                            -- destination store
  flash_sort_label JSONB DEFAULT '{}',             -- label data from Flash
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','created','shipping','delivered','returned','cancel')),
  sender_name TEXT DEFAULT '',
  sender_phone TEXT DEFAULT '',
  sender_address TEXT DEFAULT '',
  receiver_name TEXT DEFAULT '',
  receiver_phone TEXT DEFAULT '',
  receiver_address TEXT DEFAULT '',
  receiver_province TEXT DEFAULT '',
  receiver_district TEXT DEFAULT '',
  receiver_subdistrict TEXT DEFAULT '',
  receiver_postal TEXT DEFAULT '',
  cod_amount NUMERIC DEFAULT 0,
  weight INTEGER DEFAULT 1000,                     -- grams
  remark TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add flash_pno column to sp_orders for quick reference
ALTER TABLE sp_orders ADD COLUMN IF NOT EXISTS flash_pno TEXT DEFAULT '';
ALTER TABLE sp_orders ADD COLUMN IF NOT EXISTS parcel_no TEXT DEFAULT '';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sp_parcels_order ON sp_parcels(order_id);
CREATE INDEX IF NOT EXISTS idx_sp_parcels_flash ON sp_parcels(flash_pno);
CREATE INDEX IF NOT EXISTS idx_sp_parcels_status ON sp_parcels(status);

-- RLS
ALTER TABLE sp_parcels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin all sp_parcels" ON sp_parcels FOR ALL USING (true);
