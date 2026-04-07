import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPageById, updatePage, getOrders, updateOrderStatus, getEventStats, getCustomers, importCustomers, deleteCustomer, uploadImage, deleteImage } from '../lib/supabase';

// ── Light theme colors (matching ClickSalepage) ──
const blue = '#2e86de', green = '#27ae60', red = '#e74c3c', gold = '#f39c12', bg = '#f0f2f5';
const statusC = { pending: '#f39c12', shipped: '#3498db', done: '#27ae60', cancel: '#e74c3c' };
const statusL = { pending: 'รอจัดการ', shipped: 'ส่งแล้ว', done: 'สำเร็จ', cancel: 'ยกเลิก' };

const inp = { width: '100%', boxSizing: 'border-box', background: '#fff', border: '1.5px solid #ddd', borderRadius: 8, padding: '11px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit', color: '#333' };
const btnBlue = { background: blue, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const btnGreen = { background: green, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const btnRed = { background: red, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };

function parseCSV(t) {
  const l = t.replace(/\r/g, '').split('\n').filter(x => x.trim());
  if (l.length < 2) return [];
  const h = l[0].replace(/^\uFEFF/, '').split(',');
  return l.slice(1).filter(x => x.split(',')[0]?.trim()).map(x => {
    const c = x.split(','), r = {}; h.forEach((hh, i) => { r[hh.trim()] = (c[i] || '').trim(); }); return r;
  });
}

// ── Block Types ──
const BLOCK_TYPES = [
  { type: 'image', icon: '📷', label: 'รูปภาพ' },
  { type: 'text', icon: '📝', label: 'ข้อความ' },
  { type: 'heading', icon: '🔤', label: 'หัวข้อใหญ่' },
  { type: 'packages', icon: '💰', label: 'แพ็คเกจราคา' },
  { type: 'painpoints', icon: '😟', label: 'ปัญหาลูกค้า' },
  { type: 'benefits', icon: '✅', label: 'จุดเด่นสินค้า' },
  { type: 'ingredients', icon: '🧪', label: 'ส่วนผสม' },
  { type: 'reviews', icon: '⭐', label: 'รีวิวลูกค้า' },
  { type: 'faq', icon: '❓', label: 'คำถามที่พบบ่อย' },
  { type: 'beforeafter', icon: '📸', label: 'Before / After' },
  { type: 'guarantee', icon: '🛡️', label: 'รับประกัน' },
];

function newBlockData(type) {
  switch (type) {
    case 'image': return { images: [] };
    case 'text': return { text: '' };
    case 'heading': return { text: '', sub: '' };
    case 'packages': return { items: [{ name: '1 ชิ้น', price: 299, orig: 590, badge: '', desc: 'ส่งฟรี' }] };
    case 'painpoints': return { items: [''] };
    case 'benefits': return { items: [{ title: '', desc: '' }] };
    case 'ingredients': return { items: [{ icon: '🌿', name: '', desc: '' }] };
    case 'reviews': return { items: [{ name: '', location: '', rating: 5, text: '' }] };
    case 'faq': return { items: [{ q: '', a: '' }] };
    case 'beforeafter': return { image: '' };
    case 'guarantee': return { text: 'ใช้แล้วไม่เห็นผล คืนเงินเต็มจำนวน' };
    default: return {};
  }
}

// ── Block Editor Components ──
function ImageBlock({ data, onChange }) {
  const ref = useRef();
  const [uploading, setUploading] = useState(false);
  const add = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange({ ...data, images: [...(data.images || []), url] });
    } catch (e) { alert('อัปโหลดไม่สำเร็จ: ' + e.message); }
    setUploading(false);
  };
  const remove = async (i) => {
    const url = data.images[i];
    if (url && !url.startsWith('data:')) { try { await deleteImage(url); } catch {} }
    onChange({ ...data, images: data.images.filter((_, idx) => idx !== i) });
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(data.images || []).map((src, i) => (
          <div key={i} style={{ position: 'relative', width: 80, height: 80, borderRadius: 10, overflow: 'hidden', border: '1px solid #eee' }}>
            <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button onClick={() => remove(i)}
              style={{ position: 'absolute', top: 2, right: 2, background: '#000a', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 11, cursor: 'pointer' }}>✕</button>
          </div>
        ))}
        <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { add(e.target.files[0]); e.target.value = ''; }} />
        <button onClick={() => !uploading && ref.current?.click()} disabled={uploading}
          style={{ width: 80, height: 80, borderRadius: 10, border: '2px dashed #ccc', background: uploading ? '#f0f0f0' : '#fafafa', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#999', gap: 2 }}>
          <span style={{ fontSize: 24 }}>{uploading ? '⏳' : '📷'}</span>
          <span style={{ fontSize: 9 }}>{uploading ? 'กำลังอัป...' : 'เพิ่มรูป'}</span>
        </button>
      </div>
      <div style={{ fontSize: 11, color: '#bbb', marginTop: 6 }}>ไม่จำกัดขนาดไฟล์ · รองรับ JPG, PNG, WebP</div>
    </div>
  );
}

function TextBlock({ data, onChange }) {
  return <textarea value={data.text || ''} onChange={e => onChange({ ...data, text: e.target.value })} placeholder="พิมพ์ข้อความ..." rows={3} style={{ ...inp, resize: 'vertical' }} />;
}

function HeadingBlock({ data, onChange }) {
  return (
    <div>
      <input value={data.text || ''} onChange={e => onChange({ ...data, text: e.target.value })} placeholder="หัวข้อหลัก" style={{ ...inp, fontSize: 18, fontWeight: 700, marginBottom: 6 }} />
      <input value={data.sub || ''} onChange={e => onChange({ ...data, sub: e.target.value })} placeholder="คำอธิบายย่อย (ไม่บังคับ)" style={{ ...inp, fontSize: 13 }} />
    </div>
  );
}

function ListEditor({ items, onChange, renderItem, newItem }) {
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>{renderItem(item, i, v => { const u = [...items]; u[i] = v; onChange(u); })}</div>
          <button onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            style={{ background: 'none', border: 'none', color: '#ccc', fontSize: 18, cursor: 'pointer', padding: '6px 2px' }}>✕</button>
        </div>
      ))}
      <button onClick={() => onChange([...items, newItem()])}
        style={{ width: '100%', padding: '10px', borderRadius: 8, border: '2px dashed #ddd', background: '#fafafa', color: '#999', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ เพิ่ม</button>
    </div>
  );
}

function PackagesBlock({ data, onChange }) {
  return <ListEditor items={data.items || []} onChange={items => onChange({ ...data, items })} newItem={() => ({ name: '', price: 0, orig: 0, badge: '', desc: '' })}
    renderItem={(pk, i, update) => (
      <div style={{ background: '#f8f9fa', borderRadius: 10, padding: 12, border: '1px solid #eee' }}>
        <input value={pk.name} onChange={e => update({ ...pk, name: e.target.value })} placeholder="ชื่อ เช่น 2 กระปุก" style={{ ...inp, fontWeight: 700, marginBottom: 4 }} />
        <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>ราคาขาย</div><input type="number" value={pk.price} onChange={e => update({ ...pk, price: e.target.value })} style={{ ...inp, color: green, fontWeight: 700 }} /></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>ราคาเต็ม</div><input type="number" value={pk.orig} onChange={e => update({ ...pk, orig: e.target.value })} style={{ ...inp, color: '#bbb', textDecoration: 'line-through' }} /></div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={pk.badge || ''} onChange={e => update({ ...pk, badge: e.target.value })} placeholder="Badge เช่น 🔥 ขายดี" style={{ ...inp, flex: 1 }} />
          <input value={pk.desc || ''} onChange={e => update({ ...pk, desc: e.target.value })} placeholder="คำอธิบาย" style={{ ...inp, flex: 1 }} />
        </div>
      </div>
    )} />;
}

function BeforeAfterBlock({ data, onChange }) {
  const ref = useRef();
  const [uploading, setUploading] = useState(false);
  const add = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange({ ...data, image: url });
    } catch (e) { alert('อัปโหลดไม่สำเร็จ'); }
    setUploading(false);
  };
  const remove = async () => {
    if (data.image && !data.image.startsWith('data:')) { try { await deleteImage(data.image); } catch {} }
    onChange({ ...data, image: '' });
  };
  return data.image ? (
    <div style={{ position: 'relative', maxWidth: 300 }}>
      <img src={data.image} style={{ width: '100%', borderRadius: 10 }} />
      <button onClick={remove} style={{ position: 'absolute', top: 4, right: 4, background: '#000a', color: '#fff', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer' }}>✕</button>
    </div>
  ) : (
    <div>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { add(e.target.files[0]); e.target.value = ''; }} />
      <button onClick={() => !uploading && ref.current?.click()} disabled={uploading}
        style={{ padding: '16px 24px', borderRadius: 10, border: '2px dashed #ddd', background: '#fafafa', color: '#999', cursor: 'pointer', fontFamily: 'inherit' }}>
        {uploading ? '⏳ กำลังอัปโหลด...' : '📷 เพิ่มรูป Before/After'}
      </button>
    </div>
  );
}

function renderBlockEditor(block, onChange) {
  const d = block.data;
  const upd = data => onChange({ ...block, data });
  switch (block.type) {
    case 'image': return <ImageBlock data={d} onChange={upd} />;
    case 'text': return <TextBlock data={d} onChange={upd} />;
    case 'heading': return <HeadingBlock data={d} onChange={upd} />;
    case 'packages': return <PackagesBlock data={d} onChange={upd} />;
    case 'beforeafter': return <BeforeAfterBlock data={d} onChange={upd} />;
    case 'guarantee': return <input value={d.text || ''} onChange={e => upd({ ...d, text: e.target.value })} placeholder="ข้อความรับประกัน" style={inp} />;
    case 'painpoints': return <ListEditor items={d.items || []} onChange={items => upd({ ...d, items })} newItem={() => ''} renderItem={(v, i, update) => <input value={v} onChange={e => update(e.target.value)} placeholder="ปัญหาลูกค้า" style={inp} />} />;
    case 'benefits': return <ListEditor items={d.items || []} onChange={items => upd({ ...d, items })} newItem={() => ({ title: '', desc: '' })} renderItem={(b, i, update) => (
      <div><input value={b.title || ''} onChange={e => update({ ...b, title: e.target.value })} placeholder="หัวข้อ" style={{ ...inp, fontWeight: 600, marginBottom: 4 }} /><input value={b.desc || ''} onChange={e => update({ ...b, desc: e.target.value })} placeholder="รายละเอียด" style={{ ...inp, fontSize: 12 }} /></div>
    )} />;
    case 'ingredients': return <ListEditor items={d.items || []} onChange={items => upd({ ...d, items })} newItem={() => ({ icon: '✨', name: '', desc: '' })} renderItem={(ing, i, update) => (
      <div style={{ display: 'flex', gap: 6 }}><input value={ing.icon || ''} onChange={e => update({ ...ing, icon: e.target.value })} style={{ ...inp, width: 44, flex: 'none', textAlign: 'center' }} /><input value={ing.name || ''} onChange={e => update({ ...ing, name: e.target.value })} placeholder="ชื่อ" style={{ ...inp, flex: 1 }} /><input value={ing.desc || ''} onChange={e => update({ ...ing, desc: e.target.value })} placeholder="คำอธิบาย" style={{ ...inp, flex: 1 }} /></div>
    )} />;
    case 'reviews': return <ListEditor items={d.items || []} onChange={items => upd({ ...d, items })} newItem={() => ({ name: '', location: '', rating: 5, text: '' })} renderItem={(r, i, update) => (
      <div style={{ background: '#f8f9fa', borderRadius: 10, padding: 12, border: '1px solid #eee' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}><input value={r.name || ''} onChange={e => update({ ...r, name: e.target.value })} placeholder="ชื่อ" style={{ ...inp, flex: 1 }} /><input value={r.location || ''} onChange={e => update({ ...r, location: e.target.value })} placeholder="จังหวัด" style={{ ...inp, flex: 1 }} /></div>
        <textarea value={r.text || ''} onChange={e => update({ ...r, text: e.target.value })} placeholder="เนื้อหารีวิว" rows={2} style={{ ...inp, resize: 'vertical' }} />
      </div>
    )} />;
    case 'faq': return <ListEditor items={d.items || []} onChange={items => upd({ ...d, items })} newItem={() => ({ q: '', a: '' })} renderItem={(fq, i, update) => (
      <div><input value={fq.q || ''} onChange={e => update({ ...fq, q: e.target.value })} placeholder="คำถาม" style={{ ...inp, fontWeight: 600, marginBottom: 4 }} /><input value={fq.a || ''} onChange={e => update({ ...fq, a: e.target.value })} placeholder="คำตอบ" style={{ ...inp, fontSize: 12 }} /></div>
    )} />;
    default: return <div style={{ color: '#999' }}>Block type: {block.type}</div>;
  }
}

// ═══════════════════════
//  MAIN COMPONENT
// ═══════════════════════
export default function PageEditor() {
  const { pageId } = useParams();
  const nav = useNavigate();
  const [page, setPage] = useState(null);
  const [f, setF] = useState({});
  const [blocks, setBlocks] = useState([]);
  const [orders, setOrders] = useState([]);
  const [events, setEvents] = useState({});
  const [customers, setCusts] = useState([]);
  const [tab, setTab] = useState('edit');
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [search, setSearch] = useState('');
  const csvRef = useRef();

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // Convert old settings to blocks format
  const settingsToBlocks = (s) => {
    const b = [];
    if (s.images?.length) b.push({ type: 'image', data: { images: s.images } });
    if (s.painPoints?.length) b.push({ type: 'painpoints', data: { items: s.painPoints } });
    if (s.benefits?.length) b.push({ type: 'benefits', data: { items: s.benefits } });
    if (s.ingredients?.length) b.push({ type: 'ingredients', data: { items: s.ingredients } });
    if (s.beforeAfterImg) b.push({ type: 'beforeafter', data: { image: s.beforeAfterImg } });
    if (s.reviews?.length) b.push({ type: 'reviews', data: { items: s.reviews } });
    if (s.packages?.length) b.push({ type: 'packages', data: { items: s.packages } });
    if (s.faq?.length) b.push({ type: 'faq', data: { items: s.faq } });
    if (s.guarantee) b.push({ type: 'guarantee', data: { text: s.guarantee } });
    return b.length ? b : s.blocks || [];
  };

  // Convert blocks back to settings
  const blocksToSettings = (blocks) => {
    const s = {};
    s.blocks = blocks;
    blocks.forEach(b => {
      switch (b.type) {
        case 'image': s.images = b.data.images || []; break;
        case 'painpoints': s.painPoints = b.data.items || []; break;
        case 'benefits': s.benefits = b.data.items || []; break;
        case 'ingredients': s.ingredients = b.data.items || []; break;
        case 'beforeafter': s.beforeAfterImg = b.data.image || ''; break;
        case 'reviews': s.reviews = b.data.items || []; break;
        case 'packages': s.packages = (b.data.items || []).map(p => ({ ...p, price: Number(p.price) || 0, orig: Number(p.orig) || 0 })); break;
        case 'faq': s.faq = b.data.items || []; break;
        case 'guarantee': s.guarantee = b.data.text || ''; break;
      }
    });
    return s;
  };

  useEffect(() => {
    (async () => {
      const pg = await getPageById(pageId);
      if (!pg) return nav('/admin');
      setPage(pg);
      setF({ name: pg.name, slug: pg.slug, pixel_id: pg.pixel_id || '', is_active: pg.is_active, tagline: pg.settings?.tagline || '', subtitle: pg.settings?.subtitle || '', flashSale: pg.settings?.flashSale || { enabled: false, endTime: '' } });
      setBlocks(settingsToBlocks(pg.settings || {}));
      const [o, ev, cu] = await Promise.all([getOrders(pageId), getEventStats(pageId), getCustomers(pageId)]);
      setOrders(o); setEvents(ev); setCusts(cu);
    })();
  }, [pageId]);

  const doSave = async () => {
    setSaving(true);
    const settings = { ...blocksToSettings(blocks), tagline: f.tagline, subtitle: f.subtitle, flashSale: f.flashSale };
    try {
      await updatePage(pageId, { name: f.name, slug: f.slug, pixel_id: f.pixel_id, is_active: f.is_active, settings });
      showToast('✅ บันทึกสำเร็จ');
    } catch (e) { showToast('❌ ' + (e.message || 'เกิดข้อผิดพลาด')); }
    setSaving(false);
  };

  const handleStatus = async (id, st) => { await updateOrderStatus(id, st); setOrders(orders.map(o => o.id === id ? { ...o, status: st } : o)); };

  const handleCSV = file => { if (!file) return; const r = new FileReader(); r.onload = async e => { const rows = parseCSV(e.target.result); if (!rows.length) return showToast('ไม่พบข้อมูล'); try { await importCustomers(pageId, rows); setCusts([...rows.map((r, i) => ({ id: 'n' + i, data: r })), ...customers]); showToast(`✅ นำเข้า ${rows.length} รายการ`); } catch { showToast('ไม่สำเร็จ'); } }; r.readAsText(file, 'UTF-8'); };

  const addBlock = type => { setBlocks([...blocks, { type, data: newBlockData(type) }]); setShowBlockPicker(false); };
  const moveBlock = (i, dir) => { const u = [...blocks]; const j = i + dir; if (j < 0 || j >= u.length) return; [u[i], u[j]] = [u[j], u[i]]; setBlocks(u); };
  const removeBlock = i => setBlocks(blocks.filter((_, idx) => idx !== i));
  const updateBlock = (i, block) => { const u = [...blocks]; u[i] = block; setBlocks(u); };

  const pageUrl = `${window.location.origin}${import.meta.env.BASE_URL || '/'}#/${f.slug}`;
  const totalRev = orders.filter(o => o.status !== 'cancel').reduce((s, o) => s + (o.total || 0), 0);
  const blockLabel = type => BLOCK_TYPES.find(b => b.type === type);

  const copyLink = () => { navigator.clipboard?.writeText(pageUrl); showToast('📋 คัดลอกลิงค์แล้ว'); };

  if (!page) return <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Noto Sans Thai', sans-serif", color: '#999' }}>กำลังโหลด...</div>;

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'Noto Sans Thai', sans-serif", paddingBottom: 80 }}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: green, color: '#fff', padding: '10px 24px', borderRadius: 30, zIndex: 999, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,.2)' }}>{toast}</div>}

      {/* ═══ TOP HEADER ═══ */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e0e0e0', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 80 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 800, margin: '0 auto', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => nav('/admin')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#666' }}>←</button>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: blue }}>{f.name}</h1>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <a href={pageUrl} target="_blank" style={{ ...btnRed, padding: '8px 16px', fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>👁 ดูตัวอย่าง</a>
            <button onClick={doSave} disabled={saving} style={{ ...btnBlue, padding: '8px 18px', fontSize: 12 }}>{saving ? '...' : '💾 บันทึก'}</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '16px' }}>

        {/* ═══ TABS ═══ */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderRadius: 10, overflow: 'hidden', border: '1px solid #ddd' }}>
          {[['edit', '📄 หน้าหลัก'], ['orders', '📦 ออเดอร์'], ['customers', '👥 ลูกค้า']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ flex: 1, padding: '12px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                background: tab === id ? blue : '#fff', color: tab === id ? '#fff' : '#666' }}>{label}</button>
          ))}
        </div>

        {/* ═══════════════════════ */}
        {/*  EDIT TAB               */}
        {/* ═══════════════════════ */}
        {tab === 'edit' && (
          <div>
            {/* Link */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #eee' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#666', marginBottom: 6 }}>ลิงค์:</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input value={pageUrl} readOnly style={{ ...inp, flex: 1, background: '#f8f9fa', color: '#666' }} />
                <button onClick={copyLink} style={{ ...btnBlue, padding: '10px 16px', fontSize: 12, flexShrink: 0 }}>📋 คัดลอก</button>
              </div>
            </div>

            {/* Basic info */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #eee' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#333', marginBottom: 12 }}>📝 ข้อมูลพื้นฐาน</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 2 }}>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 3 }}>ชื่อสินค้า</div>
                  <input value={f.name || ''} onChange={e => setF({ ...f, name: e.target.value })} style={{ ...inp, fontWeight: 700 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 3 }}>Slug (URL)</div>
                  <input value={f.slug || ''} onChange={e => setF({ ...f, slug: e.target.value })} style={inp} />
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 3 }}>คำอธิบาย</div>
                <input value={f.tagline || ''} onChange={e => setF({ ...f, tagline: e.target.value })} placeholder="เช่น ลดฝ้า กระ ผิวขาวใส" style={inp} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: '#999', marginBottom: 3 }}>คำอธิบายรอง</div><input value={f.subtitle || ''} onChange={e => setF({ ...f, subtitle: e.target.value })} style={inp} /></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: '#999', marginBottom: 3 }}>Pixel ID</div><input value={f.pixel_id || ''} onChange={e => setF({ ...f, pixel_id: e.target.value })} placeholder="ไม่บังคับ" style={inp} /></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                <button onClick={() => setF({ ...f, is_active: !f.is_active })}
                  style={{ width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative', background: f.is_active ? green : '#ccc', transition: 'background .2s' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: f.is_active ? 25 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                </button>
                <span style={{ fontSize: 13, color: f.is_active ? green : '#999' }}>{f.is_active ? '✅ เซลเพจเปิดอยู่' : '⏸ เซลเพจปิดอยู่'}</span>
                {f.flashSale?.enabled && <span style={{ fontSize: 11, color: red, fontWeight: 600 }}>⚡ Flash Sale เปิด</span>}
              </div>
            </div>

            {/* Flash Sale toggle */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #eee' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>⚡ Flash Sale</span>
                <button onClick={() => setF({ ...f, flashSale: { ...f.flashSale, enabled: !f.flashSale?.enabled } })}
                  style={{ width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative', background: f.flashSale?.enabled ? green : '#ccc' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: f.flashSale?.enabled ? 25 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                </button>
              </div>
              {f.flashSale?.enabled && <input type="datetime-local" value={f.flashSale?.endTime || ''} onChange={e => setF({ ...f, flashSale: { ...f.flashSale, endTime: e.target.value } })} style={{ ...inp, marginTop: 10 }} />}
            </div>

            {/* ═══ CONTENT BLOCKS ═══ */}
            {blocks.map((block, i) => {
              const bt = blockLabel(block.type);
              return (
                <div key={i} style={{ background: '#fff', borderRadius: 12, marginBottom: 8, border: '1px solid #eee', overflow: 'hidden' }}>
                  {/* Block header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8f9fa', borderBottom: '1px solid #eee' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#555' }}>{bt?.icon} {bt?.label || block.type}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => moveBlock(i, -1)} disabled={i === 0} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#999', fontSize: 12 }}>↑</button>
                      <button onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#999', fontSize: 12 }}>↓</button>
                      <button onClick={() => removeBlock(i)} style={{ background: '#ffeaea', border: '1px solid #ffcdd2', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: red, fontSize: 12 }}>🗑</button>
                    </div>
                  </div>
                  {/* Block content */}
                  <div style={{ padding: 14 }}>
                    {renderBlockEditor(block, b => updateBlock(i, b))}
                  </div>
                </div>
              );
            })}

            {/* ═══ ADD BLOCK BUTTON ═══ */}
            <div onClick={() => setShowBlockPicker(!showBlockPicker)}
              style={{ background: '#e3f2fd', borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', border: '2px dashed #90caf9', marginBottom: 12 }}>
              <div style={{ fontSize: 36, marginBottom: 6 }}>✏️</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: blue }}>เพิ่มเนื้อหาใหม่</div>
            </div>

            {/* Block type picker */}
            {showBlockPicker && (
              <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #ddd', boxShadow: '0 4px 20px rgba(0,0,0,.1)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 10 }}>เลือกประเภทเนื้อหา:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                  {BLOCK_TYPES.map(bt => (
                    <button key={bt.type} onClick={() => addBlock(bt.type)}
                      style={{ padding: '14px 10px', borderRadius: 10, border: '1.5px solid #eee', background: '#fafafa', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', transition: 'all .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = blue; e.currentTarget.style.background = '#e3f2fd'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#eee'; e.currentTarget.style.background = '#fafafa'; }}>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>{bt.icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>{bt.label}</div>
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowBlockPicker(false)} style={{ width: '100%', marginTop: 10, padding: '8px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#999', cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
              </div>
            )}
          </div>
        )}

        {/* ═══ ORDERS TAB ═══ */}
        {tab === 'orders' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[{ l: 'ยอดขาย', v: `฿${totalRev.toLocaleString()}`, c: green }, { l: 'ออเดอร์', v: orders.length, c: blue }, { l: 'PageView', v: events.PageView || 0, c: '#9b59b6' }, { l: 'Purchase', v: events.Purchase || 0, c: gold }].map((s, i) => (
                <div key={i} style={{ flex: 1, background: '#fff', borderRadius: 10, padding: '10px 6px', textAlign: 'center', border: '1px solid #eee' }}>
                  <div style={{ fontSize: 9, color: '#999', fontWeight: 600 }}>{s.l}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: s.c }}>{s.v}</div>
                </div>
              ))}
            </div>
            {orders.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#ccc' }}>ยังไม่มีออเดอร์</div>}
            {orders.map(o => (
              <div key={o.id} style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, border: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: '#ccc' }}>#{o.id.slice(0, 8)}</span>
                  <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, background: statusC[o.status] + '18', color: statusC[o.status], fontWeight: 600 }}>{statusL[o.status]}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2, color: '#333' }}>{o.customer_name}</div>
                <div style={{ fontSize: 12, color: '#888' }}>📞 {o.customer_tel} · 📦 {o.package_name}</div>
                <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>📍 {o.customer_addr}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontWeight: 700, color: green, fontSize: 16 }}>฿{(o.total || 0).toLocaleString()}</span>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {['pending', 'shipped', 'done', 'cancel'].map(st => (
                      <button key={st} onClick={() => handleStatus(o.id, st)}
                        style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: o.status === st ? `1.5px solid ${statusC[st]}` : '1px solid #eee', background: o.status === st ? statusC[st] + '15' : '#fff', color: o.status === st ? statusC[st] : '#ccc', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                        {statusL[st]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ CUSTOMERS TAB ═══ */}
        {tab === 'customers' && (
          <div>
            <div onClick={() => csvRef.current?.click()}
              style={{ background: '#e3f2fd', borderRadius: 12, padding: 20, marginBottom: 12, textAlign: 'center', cursor: 'pointer', border: '2px dashed #90caf9' }}>
              <input ref={csvRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { handleCSV(e.target.files[0]); e.target.value = ''; }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: blue }}>📄 Import ลูกค้าจากไฟล์ CSV</div>
            </div>
            {customers.length > 0 && <input placeholder="🔍 ค้นหา..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, marginBottom: 10 }} />}
            {customers.filter(c => !search || JSON.stringify(c.data).toLowerCase().includes(search.toLowerCase())).map(c => (
              <div key={c.id} style={{ background: '#fff', borderRadius: 10, padding: 12, marginBottom: 4, border: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                <div><span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{c.data?.['ชื่อ'] || 'ไม่มีชื่อ'}</span>
                  {c.data?.['เบอร์โทร'] && <span style={{ fontSize: 11, color: '#999', marginLeft: 8 }}>📞 {c.data['เบอร์โทร']}</span>}
                </div>
                <button onClick={async () => { await deleteCustomer(c.id); setCusts(customers.filter(x => x.id !== c.id)); }}
                  style={{ background: 'none', border: 'none', color: '#ddd', fontSize: 14, cursor: 'pointer' }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ STICKY BOTTOM ═══ */}
      {tab === 'edit' && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #eee', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 80 }}>
          <a href={pageUrl} target="_blank" style={{ ...btnRed, padding: '10px 20px', fontSize: 13, textDecoration: 'none' }}>👁 ดูตัวอย่าง</a>
          <button onClick={doSave} disabled={saving} style={{ ...btnBlue, padding: '10px 24px', fontSize: 14 }}>{saving ? 'กำลังบันทึก...' : '💾 บันทึก'}</button>
        </div>
      )}
    </div>
  );
}
