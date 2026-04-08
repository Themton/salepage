import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

// ── Pages ──
export const getPages = async () => {
  const { data } = await supabase.from('sp_pages').select('*').order('created_at', { ascending: false });
  return data || [];
};

export const getPageBySlug = async (slug) => {
  const { data } = await supabase.from('sp_pages').select('*').eq('slug', slug).eq('is_active', true).single();
  return data;
};

export const getPageById = async (id) => {
  const { data } = await supabase.from('sp_pages').select('*').eq('id', id).single();
  return data;
};

export const createPage = async (slug, name, settings = {}) => {
  const { data, error } = await supabase.from('sp_pages').insert({ slug, name, settings }).select().single();
  if (error) throw error;
  return data;
};

export const updatePage = async (id, updates) => {
  const { data, error } = await supabase.from('sp_pages').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deletePage = async (id) => {
  const { error } = await supabase.from('sp_pages').delete().eq('id', id);
  if (error) throw error;
};

// ── Orders ──
export const getOrders = async (pageId) => {
  const { data } = await supabase.from('sp_orders').select('*').eq('page_id', pageId).order('created_at', { ascending: false });
  return data || [];
};

export const getAllOrders = async () => {
  const { data } = await supabase.from('sp_orders').select('*, sp_pages(name, slug)').order('created_at', { ascending: false });
  return data || [];
};

export const createOrder = async (order) => {
  const { data, error } = await supabase.from('sp_orders').insert(order).select().single();
  if (error) throw error;
  return data;
};

export const updateOrderStatus = async (id, status) => {
  const { error } = await supabase.from('sp_orders').update({ status }).eq('id', id);
  if (error) throw error;
};

// ── Events (Meta Pixel) ──
export const trackEvent = async (pageId, eventName, eventData = {}) => {
  await supabase.from('sp_events').insert({ page_id: pageId, event_name: eventName, event_data: eventData });
};

export const getEvents = async (pageId) => {
  const { data } = await supabase.from('sp_events').select('*').eq('page_id', pageId).order('created_at', { ascending: false });
  return data || [];
};

export const getEventStats = async (pageId) => {
  const { data } = await supabase.from('sp_events').select('event_name').eq('page_id', pageId);
  const stats = {};
  (data || []).forEach(e => { stats[e.event_name] = (stats[e.event_name] || 0) + 1; });
  return stats;
};

// ── Customers ──
export const getCustomers = async (pageId) => {
  const { data } = await supabase.from('sp_customers').select('*').eq('page_id', pageId).order('created_at', { ascending: false });
  return data || [];
};

export const importCustomers = async (pageId, rows) => {
  const inserts = rows.map(r => ({ page_id: pageId, data: r }));
  const { error } = await supabase.from('sp_customers').insert(inserts);
  if (error) throw error;
};

export const deleteCustomer = async (id) => {
  await supabase.from('sp_customers').delete().eq('id', id);
};

// ── Storage (Images) ──
const BUCKET = 'sp-images';

export const uploadImage = async (file) => {
  const ext = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET).upload(fileName, file, {
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
};

export const deleteImage = async (url) => {
  const path = url.split(`${BUCKET}/`).pop();
  if (path) await supabase.storage.from(BUCKET).remove([path]);
};

// ── Parcels ──
const generateParcelNo = async () => {
  const today = new Date();
  const dateStr = today.toISOString().slice(2, 10).replace(/-/g, '');
  const prefix = `SP-${dateStr}-`;
  const { data } = await supabase.from('sp_parcels').select('parcel_no').like('parcel_no', `${prefix}%`).order('parcel_no', { ascending: false }).limit(1);
  const lastSeq = data?.[0]?.parcel_no ? parseInt(data[0].parcel_no.split('-').pop()) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
};

export const createParcelFromOrder = async (order, pageId) => {
  const parcelNo = await generateParcelNo();
  const { data, error } = await supabase.from('sp_parcels').insert({
    order_id: order.id,
    page_id: pageId,
    parcel_no: parcelNo,
    status: 'pending',
    receiver_name: order.customer_name || '',
    receiver_phone: order.customer_tel || '',
    receiver_address: order.customer_addr || '',
    cod_amount: order.total || 0,
  }).select().single();
  if (error) throw error;
  await supabase.from('sp_orders').update({ parcel_no: parcelNo }).eq('id', order.id);
  return data;
};

export const getParcels = async () => {
  const { data } = await supabase.from('sp_parcels').select('*, sp_orders(customer_name, customer_tel, customer_addr, total, package_name, meta, status)').order('created_at', { ascending: false });
  return data || [];
};

export const updateParcel = async (id, updates) => {
  const { data, error } = await supabase.from('sp_parcels').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const updateParcelFlash = async (id, flashPno, sortCode, dstStore, labelData) => {
  const { error } = await supabase.from('sp_parcels').update({
    flash_pno: flashPno,
    flash_sort_code: sortCode || '',
    flash_dst_store: dstStore || '',
    flash_sort_label: labelData || {},
    status: 'created',
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw error;
  // Also update sp_orders
  const { data: parcel } = await supabase.from('sp_parcels').select('order_id').eq('id', id).single();
  if (parcel?.order_id) {
    await supabase.from('sp_orders').update({ flash_pno: flashPno, status: 'shipped' }).eq('id', parcel.order_id);
  }
};

// ── Flash Express API (via Cloudflare Worker) ──
const FLASH_PROXY = import.meta.env.VITE_FLASH_PROXY || '';

export const flashCreateOrder = async (parcel, sender) => {
  if (!FLASH_PROXY) throw new Error('VITE_FLASH_PROXY not set');
  const resp = await fetch(FLASH_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'createOrder',
      outTradeNo: parcel.parcel_no,
      srcName: sender.name,
      srcPhone: sender.phone,
      srcAddress: sender.address,
      srcPostal: sender.postal,
      dstName: parcel.receiver_name,
      dstPhone: parcel.receiver_phone,
      dstProvince: parcel.receiver_province,
      dstDistrict: parcel.receiver_district,
      dstSubdistrict: parcel.receiver_subdistrict,
      dstPostal: parcel.receiver_postal,
      dstAddress: parcel.receiver_address,
      weight: parcel.weight || 1000,
      codAmount: parcel.cod_amount || 0,
    }),
  });
  return await resp.json();
};

export const flashGetLabel = async (pno) => {
  if (!FLASH_PROXY) throw new Error('VITE_FLASH_PROXY not set');
  const resp = await fetch(FLASH_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getLabel', pno, pageSize: '100x75' }),
  });
  return await resp.json();
};

export const flashTracking = async (pno) => {
  if (!FLASH_PROXY) throw new Error('VITE_FLASH_PROXY not set');
  const resp = await fetch(FLASH_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'tracking', pno }),
  });
  return await resp.json();
};

export const flashCancelOrder = async (pno) => {
  if (!FLASH_PROXY) throw new Error('VITE_FLASH_PROXY not set');
  const resp = await fetch(FLASH_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cancelOrder', pno }),
  });
  return await resp.json();
};
