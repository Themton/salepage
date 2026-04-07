import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPageById, updatePage, getOrders, updateOrderStatus, getEventStats, getCustomers, importCustomers, deleteCustomer } from '../lib/supabase';

const bg = '#0d0d1a', card = '#1a1a2e', gold = '#e0c097', sub = '#c4b49a';
const statusC = { pending: '#f39c12', shipped: '#3498db', done: '#2ecc71', cancel: '#e74c3c' };
const statusL = { pending: 'รอจัดการ', shipped: 'ส่งแล้ว', done: 'สำเร็จ', cancel: 'ยกเลิก' };

const inp = { width: '100%', boxSizing: 'border-box', background: bg, border: `1px solid ${gold}22`, borderRadius: 10, padding: '12px 14px', color: '#f0e6d3', fontSize: 14, outline: 'none', fontFamily: 'inherit' };
const btnGold = { background: `linear-gradient(135deg, #c9953c, ${gold})`, color: bg, border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };

function parseCSV(t) {
  const l = t.replace(/\r/g, '').split('\n').filter(x => x.trim());
  if (l.length < 2) return [];
  const h = l[0].replace(/^\uFEFF/, '').split(',');
  return l.slice(1).filter(x => x.split(',')[0]?.trim()).map(x => {
    const c = x.split(','), r = {}; h.forEach((hh, i) => { r[hh.trim()] = (c[i] || '').trim(); }); return r;
  });
}

// ── Reusable Section Card ──
function Section({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: card, borderRadius: 14, marginBottom: 10, border: `1px solid ${gold}12`, overflow: 'hidden' }}>
      <div onClick={() => setOpen(!open)} style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: gold }}>{icon} {title}</span>
        <span style={{ fontSize: 18, color: `${sub}55`, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </div>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  );
}

// ── Image Upload Area ──
function ImageUpload({ images, onChange, label, multiple = true }) {
  const ref = useRef();
  const addImg = (file) => {
    if (!file || file.size > 3e6) return;
    const r = new FileReader();
    r.onload = e => onChange(multiple ? [...images, e.target.result] : [e.target.result]);
    r.readAsDataURL(file);
  };
  return (
    <div>
      {label && <div style={{ fontSize: 12, color: `${sub}88`, marginBottom: 8 }}>{label}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {images.map((src, i) => (
          <div key={i} style={{ position: 'relative', width: 72, height: 72, borderRadius: 12, overflow: 'hidden', border: `1px solid ${gold}22` }}>
            <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button onClick={() => onChange(images.filter((_, idx) => idx !== i))}
              style={{ position: 'absolute', top: 3, right: 3, background: '#000a', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        ))}
        <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { addImg(e.target.files[0]); e.target.value = ''; }} />
        <button onClick={() => ref.current?.click()}
          style={{ width: 72, height: 72, borderRadius: 12, border: `2px dashed ${gold}33`, background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: sub, gap: 2 }}>
          <span style={{ fontSize: 24 }}>📷</span>
          <span style={{ fontSize: 9 }}>เพิ่มรูป</span>
        </button>
      </div>
    </div>
  );
}

// ── Editable List ──
function EditList({ items, onChange, placeholder, renderItem }) {
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>{renderItem ? renderItem(item, i, (v) => { const u = [...items]; u[i] = v; onChange(u); }) : (
            <input value={item} onChange={e => { const u = [...items]; u[i] = e.target.value; onChange(u); }} placeholder={placeholder} style={inp} />
          )}</div>
          <button onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            style={{ background: 'none', border: 'none', color: '#e74c3c44', fontSize: 16, cursor: 'pointer', padding: '8px 4px', flexShrink: 0 }}>✕</button>
        </div>
      ))}
      <button onClick={() => onChange([...items, renderItem ? {} : ''])}
        style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: `1.5px dashed ${gold}33`, background: 'transparent', color: gold, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
        + เพิ่ม
      </button>
    </div>
  );
}

// ═══════════════════════
//  MAIN COMPONENT
// ═══════════════════════
export default function PageEditor() {
  const { pageId } = useParams();
  const nav = useNavigate();
  const [page, setPage] = useState(null);
  const [f, setF] = useState({});
  const [orders, setOrders] = useState([]);
  const [events, setEvents] = useState({});
  const [customers, setCusts] = useState([]);
  const [tab, setTab] = useState('edit');
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const csvRef = useRef();

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    (async () => {
      const pg = await getPageById(pageId);
      if (!pg) return nav('/admin');
      setPage(pg);
      setF({ name: pg.name, slug: pg.slug, pixel_id: pg.pixel_id || '', is_active: pg.is_active, ...pg.settings });
      const [o, ev, cu] = await Promise.all([getOrders(pageId), getEventStats(pageId), getCustomers(pageId)]);
      setOrders(o); setEvents(ev); setCusts(cu);
    })();
  }, [pageId]);

  // Save
  const doSave = async () => {
    setSaving(true);
    const { name, slug, pixel_id, is_active, ...settings } = f;
    settings.packages = (settings.packages || []).map(p => ({ ...p, price: Number(p.price) || 0, orig: Number(p.orig) || 0 }));
    try {
      await updatePage(pageId, { name, slug, pixel_id, is_active, settings });
      showToast('✅ บันทึกสำเร็จ');
    } catch (e) { showToast('❌ ' + (e.message || 'เกิดข้อผิดพลาด')); }
    setSaving(false);
  };

  // Order status
  const handleStatus = async (id, st) => {
    await updateOrderStatus(id, st);
    setOrders(orders.map(o => o.id === id ? { ...o, status: st } : o));
  };

  // CSV import
  const handleCSV = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = async (e) => {
      const rows = parseCSV(e.target.result);
      if (!rows.length) return showToast('ไม่พบข้อมูล');
      try {
        await importCustomers(pageId, rows);
        setCusts([...rows.map((r, i) => ({ id: 'new' + i, data: r })), ...customers]);
        showToast(`✅ นำเข้า ${rows.length} รายการ`);
      } catch { showToast('นำเข้าไม่สำเร็จ'); }
    };
    r.readAsText(file, 'UTF-8');
  };

  const totalRev = orders.filter(o => o.status !== 'cancel').reduce((s, o) => s + (o.total || 0), 0);

  if (!page) return <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0e6d3', fontFamily: "'Noto Sans Thai', sans-serif" }}>กำลังโหลด...</div>;

  return (
    <div style={{ minHeight: '100vh', background: bg, color: '#f0e6d3', fontFamily: "'Noto Sans Thai', sans-serif", padding: '16px 16px 100px' }}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#2d6b45', color: '#fff', padding: '10px 24px', borderRadius: 30, zIndex: 999, fontSize: 14, fontWeight: 600 }}>{toast}</div>}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <button onClick={() => nav('/admin')} style={{ background: 'none', border: 'none', color: gold, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>← กลับ</button>
          <h2 style={{ margin: '4px 0 0', color: gold, fontSize: 18 }}>{f.name || 'แก้ไขเซลเพจ'}</h2>
        </div>
        <a href={`${window.location.origin}${import.meta.env.BASE_URL || '/'}#/${f.slug}`} target="_blank"
          style={{ background: `${gold}22`, color: gold, borderRadius: 8, padding: '8px 14px', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>👁 ดูเพจ</a>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
        {[{ l: 'ยอดขาย', v: `฿${totalRev.toLocaleString()}`, c: '#2ecc71' }, { l: 'ออเดอร์', v: orders.length, c: '#3498db' }, { l: 'PageView', v: events.PageView || 0, c: '#9b59b6' }, { l: 'Purchase', v: events.Purchase || 0, c: '#e67e22' }].map((s, i) => (
          <div key={i} style={{ background: card, borderRadius: 10, padding: '10px 6px', textAlign: 'center', border: `1px solid ${gold}10` }}>
            <div style={{ fontSize: 8, color: `${sub}66`, fontWeight: 600 }}>{s.l}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
        {[['edit', '✏️ แก้ไข'], ['orders', '📦 ออเดอร์'], ['customers', '👥 ลูกค้า']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ background: tab === id ? gold : card, color: tab === id ? bg : sub, border: `1px solid ${gold}22`, borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flex: 1 }}>{label}</button>
        ))}
      </div>

      {/* ═══════════════════════ */}
      {/*  EDIT TAB               */}
      {/* ═══════════════════════ */}
      {tab === 'edit' && (
        <div>
          {/* ── ข้อมูลหลัก ── */}
          <Section title="ข้อมูลสินค้า" icon="📝" defaultOpen={true}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: `${sub}88`, marginBottom: 4 }}>ชื่อสินค้า</div>
              <input value={f.name || ''} onChange={e => setF({ ...f, name: e.target.value })} placeholder="เช่น ครีมโสม Ginseng Cream" style={{ ...inp, fontSize: 16, fontWeight: 700 }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: `${sub}88`, marginBottom: 4 }}>คำอธิบายหลัก</div>
              <input value={f.tagline || ''} onChange={e => setF({ ...f, tagline: e.target.value })} placeholder="เช่น ลดฝ้า กระ จุดด่างดำ" style={inp} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: `${sub}88`, marginBottom: 4 }}>คำอธิบายรอง</div>
              <input value={f.subtitle || ''} onChange={e => setF({ ...f, subtitle: e.target.value })} placeholder="เช่น สูตรเข้มข้นจากโสมเกาหลี" style={inp} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: `${sub}88`, marginBottom: 4 }}>URL slug</div>
                <input value={f.slug || ''} onChange={e => setF({ ...f, slug: e.target.value })} style={inp} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: `${sub}88`, marginBottom: 4 }}>Pixel ID</div>
                <input value={f.pixel_id || ''} onChange={e => setF({ ...f, pixel_id: e.target.value })} placeholder="ไม่บังคับ" style={inp} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <button onClick={() => setF({ ...f, is_active: !f.is_active })}
                style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', background: f.is_active ? '#2ecc71' : '#444', flexShrink: 0 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: f.is_active ? 23 : 3, transition: 'left .2s' }} />
              </button>
              <span style={{ fontSize: 13, color: f.is_active ? '#2ecc71' : `${sub}44` }}>{f.is_active ? 'เซลเพจเปิดอยู่' : 'เซลเพจปิดอยู่'}</span>
            </div>
          </Section>

          {/* ── รูปภาพ ── */}
          <Section title="รูปภาพสินค้า" icon="📷" defaultOpen={true}>
            <ImageUpload images={f.images || []} onChange={imgs => setF({ ...f, images: imgs })} label="รูปจะแสดงเป็นแถบเลื่อน (Slider) — เพิ่มได้หลายรูป" />
            <div style={{ marginTop: 16 }}>
              <ImageUpload images={f.beforeAfterImg ? [f.beforeAfterImg] : []} onChange={imgs => setF({ ...f, beforeAfterImg: imgs[0] || '' })} label="รูป Before / After (1 รูป)" multiple={false} />
            </div>
          </Section>

          {/* ── โปรโมชัน/แพ็คเกจ ── */}
          <Section title="โปรโมชัน / แพ็คเกจราคา" icon="💰" defaultOpen={true}>
            {(f.packages || []).map((pk, i) => (
              <div key={i} style={{ background: bg, borderRadius: 12, padding: 14, marginBottom: 8, position: 'relative', border: `1px solid ${gold}15` }}>
                <button onClick={() => setF({ ...f, packages: f.packages.filter((_, idx) => idx !== i) })}
                  style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', color: '#e74c3c44', fontSize: 14, cursor: 'pointer' }}>✕</button>
                <input value={pk.name} onChange={e => { const u = [...f.packages]; u[i] = { ...u[i], name: e.target.value }; setF({ ...f, packages: u }); }}
                  placeholder="ชื่อ เช่น 2 กระปุก สุดคุ้ม" style={{ ...inp, marginBottom: 6, fontWeight: 600 }} />
                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: `${sub}66`, marginBottom: 2 }}>ราคาขาย</div>
                    <input type="number" value={pk.price} onChange={e => { const u = [...f.packages]; u[i] = { ...u[i], price: e.target.value }; setF({ ...f, packages: u }); }}
                      style={{ ...inp, color: '#2ecc71', fontWeight: 700, fontSize: 18 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: `${sub}66`, marginBottom: 2 }}>ราคาเต็ม (ขีดฆ่า)</div>
                    <input type="number" value={pk.orig} onChange={e => { const u = [...f.packages]; u[i] = { ...u[i], orig: e.target.value }; setF({ ...f, packages: u }); }}
                      style={{ ...inp, textDecoration: 'line-through', color: `${sub}66` }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={pk.badge || ''} onChange={e => { const u = [...f.packages]; u[i] = { ...u[i], badge: e.target.value }; setF({ ...f, packages: u }); }}
                    placeholder="Badge เช่น 🔥 ขายดี" style={{ ...inp, flex: 1 }} />
                  <input value={pk.desc || ''} onChange={e => { const u = [...f.packages]; u[i] = { ...u[i], desc: e.target.value }; setF({ ...f, packages: u }); }}
                    placeholder="คำอธิบาย เช่น ส่งฟรี" style={{ ...inp, flex: 1 }} />
                </div>
              </div>
            ))}
            <button onClick={() => setF({ ...f, packages: [...(f.packages || []), { name: '', badge: '', desc: 'ส่งฟรี', price: 0, orig: 0 }] })}
              style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: `2px dashed ${gold}33`, background: 'transparent', color: gold, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
              + เพิ่มแพ็คเกจ
            </button>
          </Section>

          {/* ── ข้อความ Pain Points ── */}
          <Section title="ปัญหาของลูกค้า" icon="😟">
            <EditList items={f.painPoints || []} onChange={v => setF({ ...f, painPoints: v })} placeholder="เช่น ผิวหมองคล้ำ ไม่กระจ่างใส" />
          </Section>

          {/* ── จุดเด่น ── */}
          <Section title="จุดเด่นสินค้า" icon="✅">
            <EditList items={f.benefits || []} onChange={v => setF({ ...f, benefits: v })}
              renderItem={(b, i, update) => (
                <div>
                  <input value={b.title || ''} onChange={e => update({ ...b, title: e.target.value })} placeholder="หัวข้อ เช่น ลดฝ้า กระ" style={{ ...inp, marginBottom: 4, fontWeight: 600 }} />
                  <input value={b.desc || ''} onChange={e => update({ ...b, desc: e.target.value })} placeholder="รายละเอียด" style={{ ...inp, fontSize: 12 }} />
                </div>
              )} />
          </Section>

          {/* ── ส่วนผสม ── */}
          <Section title="ส่วนผสม" icon="🧪">
            <EditList items={f.ingredients || []} onChange={v => setF({ ...f, ingredients: v })}
              renderItem={(ing, i, update) => (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={ing.icon || ''} onChange={e => update({ ...ing, icon: e.target.value })} placeholder="🌿" style={{ ...inp, width: 44, flex: 'none', textAlign: 'center' }} />
                  <input value={ing.name || ''} onChange={e => update({ ...ing, name: e.target.value })} placeholder="ชื่อ" style={{ ...inp, flex: 1 }} />
                  <input value={ing.desc || ''} onChange={e => update({ ...ing, desc: e.target.value })} placeholder="คำอธิบาย" style={{ ...inp, flex: 1 }} />
                </div>
              )} />
          </Section>

          {/* ── รีวิว ── */}
          <Section title="รีวิวจากลูกค้า" icon="⭐">
            <EditList items={f.reviews || []} onChange={v => setF({ ...f, reviews: v })}
              renderItem={(r, i, update) => (
                <div style={{ background: bg, borderRadius: 10, padding: 10 }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                    <input value={r.name || ''} onChange={e => update({ ...r, name: e.target.value })} placeholder="ชื่อ เช่น คุณมิ้นท์" style={{ ...inp, flex: 1 }} />
                    <input value={r.location || ''} onChange={e => update({ ...r, location: e.target.value })} placeholder="จังหวัด" style={{ ...inp, flex: 1 }} />
                  </div>
                  <textarea value={r.text || ''} onChange={e => update({ ...r, text: e.target.value })} placeholder="เนื้อหารีวิว..." rows={2}
                    style={{ ...inp, resize: 'vertical' }} />
                </div>
              )} />
          </Section>

          {/* ── FAQ ── */}
          <Section title="คำถามที่พบบ่อย" icon="❓">
            <EditList items={f.faq || []} onChange={v => setF({ ...f, faq: v })}
              renderItem={(fq, i, update) => (
                <div>
                  <input value={fq.q || ''} onChange={e => update({ ...fq, q: e.target.value })} placeholder="คำถาม" style={{ ...inp, marginBottom: 4, fontWeight: 600 }} />
                  <input value={fq.a || ''} onChange={e => update({ ...fq, a: e.target.value })} placeholder="คำตอบ" style={{ ...inp, fontSize: 12 }} />
                </div>
              )} />
          </Section>

          {/* ── Flash Sale ── */}
          <Section title="Flash Sale" icon="⚡">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <button onClick={() => setF({ ...f, flashSale: { ...f.flashSale, enabled: !f.flashSale?.enabled } })}
                style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', background: f.flashSale?.enabled ? '#2ecc71' : '#444', flexShrink: 0 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: f.flashSale?.enabled ? 23 : 3, transition: 'left .2s' }} />
              </button>
              <span style={{ fontSize: 13, color: f.flashSale?.enabled ? '#2ecc71' : `${sub}44` }}>{f.flashSale?.enabled ? 'เปิด' : 'ปิด'}</span>
            </div>
            {f.flashSale?.enabled && (
              <div>
                <div style={{ fontSize: 12, color: `${sub}88`, marginBottom: 4 }}>หมดเวลาเมื่อ</div>
                <input type="datetime-local" value={f.flashSale?.endTime || ''} onChange={e => setF({ ...f, flashSale: { ...f.flashSale, endTime: e.target.value } })}
                  style={{ ...inp, colorScheme: 'dark' }} />
              </div>
            )}
          </Section>

          {/* ── รับประกัน ── */}
          <Section title="ข้อความรับประกัน" icon="🛡️">
            <input value={f.guarantee || ''} onChange={e => setF({ ...f, guarantee: e.target.value })}
              placeholder="เช่น ใช้แล้วไม่เห็นผล คืนเงินเต็มจำนวน" style={inp} />
          </Section>
        </div>
      )}

      {/* ═══════════════════════ */}
      {/*  ORDERS TAB              */}
      {/* ═══════════════════════ */}
      {tab === 'orders' && (
        <div>
          {orders.length === 0 && <p style={{ color: `${sub}44`, textAlign: 'center', padding: 30, fontSize: 14 }}>ยังไม่มีออเดอร์</p>}
          {orders.map(o => (
            <div key={o.id} style={{ background: card, borderRadius: 14, padding: 14, marginBottom: 8, border: `1px solid ${gold}10` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: `${sub}44` }}>#{o.id.slice(0, 8)}</span>
                <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, background: statusC[o.status] + '22', color: statusC[o.status], fontWeight: 600 }}>{statusL[o.status]}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{o.customer_name}</div>
              <div style={{ fontSize: 12, color: `${sub}88`, marginBottom: 2 }}>📞 {o.customer_tel}</div>
              <div style={{ fontSize: 12, color: `${sub}66`, marginBottom: 2 }}>📦 {o.package_name}</div>
              <div style={{ fontSize: 12, color: `${sub}55`, marginBottom: 6 }}>📍 {o.customer_addr}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontWeight: 700, color: gold, fontSize: 16 }}>฿{(o.total || 0).toLocaleString()}</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {['pending', 'shipped', 'done', 'cancel'].map(st => (
                    <button key={st} onClick={() => handleStatus(o.id, st)}
                      style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: o.status === st ? `1px solid ${statusC[st]}` : `1px solid ${gold}12`, background: o.status === st ? statusC[st] + '33' : 'transparent', color: o.status === st ? statusC[st] : `${sub}33`, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {statusL[st]}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 10, color: `${sub}33`, marginTop: 6 }}>{new Date(o.created_at).toLocaleString('th-TH')}</div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════ */}
      {/*  CUSTOMERS TAB           */}
      {/* ═══════════════════════ */}
      {tab === 'customers' && (
        <div>
          <div onClick={() => csvRef.current?.click()}
            style={{ background: card, borderRadius: 14, padding: 20, marginBottom: 12, textAlign: 'center', cursor: 'pointer', border: `2px dashed ${gold}33` }}>
            <input ref={csvRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { handleCSV(e.target.files[0]); e.target.value = ''; }} />
            <div style={{ fontSize: 28, marginBottom: 4 }}>📄</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: gold }}>Import ลูกค้าจากไฟล์ CSV</div>
            <div style={{ fontSize: 11, color: `${sub}55` }}>คลิกเพื่อเลือกไฟล์</div>
          </div>
          {customers.length > 0 && <input placeholder="🔍 ค้นหา..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, marginBottom: 10 }} />}
          {customers.filter(c => !search || JSON.stringify(c.data).toLowerCase().includes(search.toLowerCase())).map(c => (
            <div key={c.id} style={{ background: card, borderRadius: 12, padding: 12, marginBottom: 4, border: `1px solid ${gold}10` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{c.data?.['ชื่อ'] || 'ไม่มีชื่อ'}</span>
                <button onClick={async () => { await deleteCustomer(c.id); setCusts(customers.filter(x => x.id !== c.id)); }}
                  style={{ background: 'none', border: 'none', color: '#e74c3c33', fontSize: 12, cursor: 'pointer' }}>✕</button>
              </div>
              {c.data?.['เบอร์โทร'] && <div style={{ fontSize: 11, color: `${sub}66` }}>📞 {c.data['เบอร์โทร']}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ═══ STICKY SAVE BUTTON ═══ */}
      {tab === 'edit' && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: bg, padding: '12px 16px', boxShadow: `0 -4px 20px rgba(0,0,0,.5)`, zIndex: 80 }}>
          <button onClick={doSave} disabled={saving}
            style={{ ...btnGold, width: '100%', padding: '14px 0', fontSize: 16, borderRadius: 12 }}>
            {saving ? 'กำลังบันทึก...' : '💾 บันทึกทั้งหมด'}
          </button>
        </div>
      )}
    </div>
  );
}
