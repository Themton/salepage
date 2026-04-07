import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPageById, updatePage, getOrders, updateOrderStatus, getEventStats, getCustomers, importCustomers, deleteCustomer } from '../lib/supabase';

const bg = '#0d0d1a', card = '#1a1a2e', gold = '#e0c097', sub = '#c4b49a';
const statusC = { pending: '#f39c12', shipped: '#3498db', done: '#2ecc71', cancel: '#e74c3c' };
const statusL = { pending: 'รอ', shipped: 'ส่งแล้ว', done: 'สำเร็จ', cancel: 'ยกเลิก' };
const inp = { width: '100%', boxSizing: 'border-box', background: bg, border: `1px solid ${gold}22`, borderRadius: 8, padding: '10px 12px', color: '#f0e6d3', fontSize: 13, outline: 'none', fontFamily: 'inherit' };

function parseCSV(t) {
  const l = t.replace(/\r/g, '').split('\n').filter(x => x.trim());
  if (l.length < 2) return [];
  const h = l[0].replace(/^\uFEFF/, '').split(',');
  return l.slice(1).filter(x => x.split(',')[0]?.trim()).map(x => {
    const c = x.split(','), r = {}; h.forEach((hh, i) => { r[hh.trim()] = (c[i] || '').trim(); }); return r;
  });
}

export default function PageEditor() {
  const { pageId } = useParams();
  const nav = useNavigate();
  const [page, setPage] = useState(null);
  const [f, setF] = useState({});
  const [orders, setOrders] = useState([]);
  const [events, setEvents] = useState({});
  const [customers, setCusts] = useState([]);
  const [tab, setTab] = useState('settings');
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const fileRef = useRef();

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

  const handleStatus = async (id, st) => {
    await updateOrderStatus(id, st);
    setOrders(orders.map(o => o.id === id ? { ...o, status: st } : o));
  };

  const addImg = (file, cb) => { if (!file || file.size > 3e6) return; const r = new FileReader(); r.onload = e => cb(e.target.result); r.readAsDataURL(file); };

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
      } catch (e) { showToast('นำเข้าไม่สำเร็จ'); }
    };
    r.readAsText(file, 'UTF-8');
  };

  const label = t => <div style={{ fontSize: 11, color: `${sub}88`, marginTop: 12, marginBottom: 4 }}>{t}</div>;
  const totalRev = orders.filter(o => o.status !== 'cancel').reduce((s, o) => s + (o.total || 0), 0);

  if (!page) return <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0e6d3', fontFamily: "'Noto Sans Thai', sans-serif" }}>กำลังโหลด...</div>;

  return (
    <div style={{ minHeight: '100vh', background: bg, color: '#f0e6d3', fontFamily: "'Noto Sans Thai', sans-serif", padding: 16 }}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#2d6b45', color: '#fff', padding: '10px 24px', borderRadius: 30, zIndex: 999, fontSize: 14, fontWeight: 600 }}>{toast}</div>}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <button onClick={() => nav('/admin')} style={{ background: 'none', border: 'none', color: gold, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 4 }}>← กลับ</button>
          <h2 style={{ margin: 0, color: gold, fontSize: 18 }}>✏️ {f.name}</h2>
          <div style={{ fontSize: 11, color: `${sub}77` }}>/{f.slug}</div>
        </div>
        <a href={`/${f.slug}`} target="_blank" style={{ background: `${gold}22`, color: gold, border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, textDecoration: 'none' }}>👁 ดูหน้าเพจ</a>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 6, marginBottom: 16 }}>
        {[{ l: 'ยอดขาย', v: `฿${totalRev.toLocaleString()}`, c: '#2ecc71' }, { l: 'ออเดอร์', v: orders.length, c: '#3498db' }, { l: 'PageView', v: events.PageView || 0, c: '#9b59b6' }, { l: 'Purchase', v: events.Purchase || 0, c: '#e67e22' }].map((s, i) => (
          <div key={i} style={{ background: card, borderRadius: 10, padding: '10px 6px', textAlign: 'center', border: `1px solid ${gold}10` }}>
            <div style={{ fontSize: 8, color: `${sub}66`, fontWeight: 600 }}>{s.l}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['settings', '⚙ ตั้งค่า'], ['orders', '📦 ออเดอร์'], ['customers', '👥 ลูกค้า']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ background: tab === id ? gold : card, color: tab === id ? bg : sub, border: `1px solid ${gold}22`, borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
        ))}
      </div>

      {/* ═══ SETTINGS ═══ */}
      {tab === 'settings' && (
        <div style={{ background: card, borderRadius: 14, padding: 16, border: `1px solid ${gold}12` }}>

          {label('ชื่อสินค้า')}<input value={f.name || ''} onChange={e => setF({ ...f, name: e.target.value })} style={inp} />
          {label('Slug (URL)')}<input value={f.slug || ''} onChange={e => setF({ ...f, slug: e.target.value })} style={inp} />
          {label('Meta Pixel ID')}<input value={f.pixel_id || ''} onChange={e => setF({ ...f, pixel_id: e.target.value })} placeholder="123456789" style={inp} />
          {label('คำอธิบาย')}<input value={f.tagline || ''} onChange={e => setF({ ...f, tagline: e.target.value })} style={inp} />
          {label('คำอธิบายรอง')}<input value={f.subtitle || ''} onChange={e => setF({ ...f, subtitle: e.target.value })} style={inp} />

          {/* Active toggle */}
          {label('สถานะ')}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setF({ ...f, is_active: !f.is_active })}
              style={{ width: 38, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative', background: f.is_active ? '#2ecc71' : '#444' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: f.is_active ? 21 : 3, transition: 'left .2s' }} />
            </button>
            <span style={{ fontSize: 12, color: f.is_active ? '#2ecc71' : `${sub}44` }}>{f.is_active ? 'เปิดใช้งาน' : 'ปิดอยู่'}</span>
          </div>

          {/* Images */}
          {label('📷 รูปสินค้า')}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {(f.images || []).map((src, i) => (
              <div key={i} style={{ position: 'relative', width: 56, height: 56, borderRadius: 8, overflow: 'hidden' }}>
                <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => setF({ ...f, images: f.images.filter((_, idx) => idx !== i) })} style={{ position: 'absolute', top: 1, right: 1, background: '#000a', color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, fontSize: 8, cursor: 'pointer' }}>✕</button>
              </div>
            ))}
            <label style={{ width: 56, height: 56, borderRadius: 8, border: `1px dashed ${gold}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: sub, fontSize: 20 }}>+<input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => addImg(e.target.files[0], d => setF({ ...f, images: [...(f.images || []), d] }))} /></label>
          </div>

          {label('📸 Before/After')}
          {f.beforeAfterImg ? (
            <div style={{ position: 'relative', width: 100 }}><img src={f.beforeAfterImg} style={{ width: '100%', borderRadius: 8 }} /><button onClick={() => setF({ ...f, beforeAfterImg: '' })} style={{ position: 'absolute', top: 2, right: 2, background: '#000a', color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, fontSize: 8, cursor: 'pointer' }}>✕</button></div>
          ) : <label style={{ fontSize: 11, color: gold, cursor: 'pointer' }}>📷 เพิ่มรูป<input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => addImg(e.target.files[0], d => setF({ ...f, beforeAfterImg: d }))} /></label>}

          {/* Packages */}
          {label('💰 แพ็คเกจราคา')}
          {(f.packages || []).map((pk, i) => (
            <div key={i} style={{ background: bg, borderRadius: 8, padding: 8, marginBottom: 4, position: 'relative' }}>
              <button onClick={() => setF({ ...f, packages: f.packages.filter((_, idx) => idx !== i) })} style={{ position: 'absolute', top: 2, right: 4, background: 'none', border: 'none', color: '#e74c3c44', fontSize: 10, cursor: 'pointer' }}>✕</button>
              <div style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
                <input value={pk.name} onChange={e => { const u = [...f.packages]; u[i] = { ...u[i], name: e.target.value }; setF({ ...f, packages: u }); }} placeholder="ชื่อ" style={{ ...inp, flex: 2 }} />
                <input value={pk.badge || ''} onChange={e => { const u = [...f.packages]; u[i] = { ...u[i], badge: e.target.value }; setF({ ...f, packages: u }); }} placeholder="Badge" style={{ ...inp, flex: 1 }} />
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input type="number" value={pk.price} onChange={e => { const u = [...f.packages]; u[i] = { ...u[i], price: e.target.value }; setF({ ...f, packages: u }); }} placeholder="ราคาขาย" style={{ ...inp, flex: 1 }} />
                <input type="number" value={pk.orig} onChange={e => { const u = [...f.packages]; u[i] = { ...u[i], orig: e.target.value }; setF({ ...f, packages: u }); }} placeholder="ราคาเต็ม" style={{ ...inp, flex: 1 }} />
              </div>
              <input value={pk.desc || ''} onChange={e => { const u = [...f.packages]; u[i] = { ...u[i], desc: e.target.value }; setF({ ...f, packages: u }); }} placeholder="คำอธิบาย" style={{ ...inp, marginTop: 3 }} />
            </div>
          ))}
          <button onClick={() => setF({ ...f, packages: [...(f.packages || []), { name: '', badge: '', desc: '', price: 0, orig: 0 }] })} style={{ fontSize: 10, color: gold, background: 'none', border: `1px dashed ${gold}33`, borderRadius: 6, padding: '5px 0', width: '100%', cursor: 'pointer', fontFamily: 'inherit' }}>+ เพิ่มแพ็คเกจ</button>

          {/* Pain Points */}
          {label('😟 Pain Points')}
          {(f.painPoints || []).map((pt, i) => (
            <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
              <input value={pt} onChange={e => { const u = [...f.painPoints]; u[i] = e.target.value; setF({ ...f, painPoints: u }); }} style={{ ...inp, flex: 1 }} />
              <button onClick={() => setF({ ...f, painPoints: f.painPoints.filter((_, idx) => idx !== i) })} style={{ background: 'none', border: 'none', color: '#e74c3c44', fontSize: 10, cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <button onClick={() => setF({ ...f, painPoints: [...(f.painPoints || []), ''] })} style={{ fontSize: 10, color: gold, background: 'none', border: `1px dashed ${gold}33`, borderRadius: 6, padding: '4px 0', width: '100%', cursor: 'pointer', fontFamily: 'inherit' }}>+</button>

          {/* Benefits */}
          {label('✓ จุดเด่น')}
          {(f.benefits || []).map((b, i) => (
            <div key={i} style={{ background: bg, borderRadius: 6, padding: 6, marginBottom: 3, position: 'relative' }}>
              <button onClick={() => setF({ ...f, benefits: f.benefits.filter((_, idx) => idx !== i) })} style={{ position: 'absolute', top: 2, right: 4, background: 'none', border: 'none', color: '#e74c3c44', fontSize: 9, cursor: 'pointer' }}>✕</button>
              <input value={b.title} onChange={e => { const u = [...f.benefits]; u[i] = { ...u[i], title: e.target.value }; setF({ ...f, benefits: u }); }} placeholder="หัวข้อ" style={{ ...inp, marginBottom: 3 }} />
              <input value={b.desc} onChange={e => { const u = [...f.benefits]; u[i] = { ...u[i], desc: e.target.value }; setF({ ...f, benefits: u }); }} placeholder="รายละเอียด" style={inp} />
            </div>
          ))}
          <button onClick={() => setF({ ...f, benefits: [...(f.benefits || []), { title: '', desc: '' }] })} style={{ fontSize: 10, color: gold, background: 'none', border: `1px dashed ${gold}33`, borderRadius: 6, padding: '4px 0', width: '100%', cursor: 'pointer', fontFamily: 'inherit' }}>+</button>

          {/* Ingredients */}
          {label('🧪 ส่วนผสม')}
          {(f.ingredients || []).map((ing, i) => (
            <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
              <input value={ing.icon} onChange={e => { const u = [...f.ingredients]; u[i] = { ...u[i], icon: e.target.value }; setF({ ...f, ingredients: u }); }} placeholder="🌿" style={{ ...inp, width: 40, flex: 'none' }} />
              <input value={ing.name} onChange={e => { const u = [...f.ingredients]; u[i] = { ...u[i], name: e.target.value }; setF({ ...f, ingredients: u }); }} placeholder="ชื่อ" style={{ ...inp, flex: 1 }} />
              <input value={ing.desc} onChange={e => { const u = [...f.ingredients]; u[i] = { ...u[i], desc: e.target.value }; setF({ ...f, ingredients: u }); }} placeholder="คำอธิบาย" style={{ ...inp, flex: 1 }} />
              <button onClick={() => setF({ ...f, ingredients: f.ingredients.filter((_, idx) => idx !== i) })} style={{ background: 'none', border: 'none', color: '#e74c3c44', fontSize: 10, cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <button onClick={() => setF({ ...f, ingredients: [...(f.ingredients || []), { icon: '✨', name: '', desc: '' }] })} style={{ fontSize: 10, color: gold, background: 'none', border: `1px dashed ${gold}33`, borderRadius: 6, padding: '4px 0', width: '100%', cursor: 'pointer', fontFamily: 'inherit' }}>+</button>

          {/* Reviews */}
          {label('⭐ รีวิว')}
          {(f.reviews || []).map((r, i) => (
            <div key={i} style={{ background: bg, borderRadius: 6, padding: 6, marginBottom: 3, position: 'relative' }}>
              <button onClick={() => setF({ ...f, reviews: f.reviews.filter((_, idx) => idx !== i) })} style={{ position: 'absolute', top: 2, right: 4, background: 'none', border: 'none', color: '#e74c3c44', fontSize: 9, cursor: 'pointer' }}>✕</button>
              <div style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
                <input value={r.name} onChange={e => { const u = [...f.reviews]; u[i] = { ...u[i], name: e.target.value }; setF({ ...f, reviews: u }); }} placeholder="ชื่อ" style={{ ...inp, flex: 1 }} />
                <input value={r.location || ''} onChange={e => { const u = [...f.reviews]; u[i] = { ...u[i], location: e.target.value }; setF({ ...f, reviews: u }); }} placeholder="จังหวัด" style={{ ...inp, flex: 1 }} />
              </div>
              <input value={r.text} onChange={e => { const u = [...f.reviews]; u[i] = { ...u[i], text: e.target.value }; setF({ ...f, reviews: u }); }} placeholder="เนื้อหารีวิว" style={inp} />
            </div>
          ))}
          <button onClick={() => setF({ ...f, reviews: [...(f.reviews || []), { name: '', location: '', rating: 5, text: '' }] })} style={{ fontSize: 10, color: gold, background: 'none', border: `1px dashed ${gold}33`, borderRadius: 6, padding: '4px 0', width: '100%', cursor: 'pointer', fontFamily: 'inherit' }}>+</button>

          {/* FAQ */}
          {label('❓ FAQ')}
          {(f.faq || []).map((fq, i) => (
            <div key={i} style={{ background: bg, borderRadius: 6, padding: 6, marginBottom: 3, position: 'relative' }}>
              <button onClick={() => setF({ ...f, faq: f.faq.filter((_, idx) => idx !== i) })} style={{ position: 'absolute', top: 2, right: 4, background: 'none', border: 'none', color: '#e74c3c44', fontSize: 9, cursor: 'pointer' }}>✕</button>
              <input value={fq.q} onChange={e => { const u = [...f.faq]; u[i] = { ...u[i], q: e.target.value }; setF({ ...f, faq: u }); }} placeholder="คำถาม" style={{ ...inp, marginBottom: 3 }} />
              <input value={fq.a} onChange={e => { const u = [...f.faq]; u[i] = { ...u[i], a: e.target.value }; setF({ ...f, faq: u }); }} placeholder="คำตอบ" style={inp} />
            </div>
          ))}
          <button onClick={() => setF({ ...f, faq: [...(f.faq || []), { q: '', a: '' }] })} style={{ fontSize: 10, color: gold, background: 'none', border: `1px dashed ${gold}33`, borderRadius: 6, padding: '4px 0', width: '100%', cursor: 'pointer', fontFamily: 'inherit' }}>+</button>

          {/* Flash Sale */}
          {label('⚡ Flash Sale')}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <button onClick={() => setF({ ...f, flashSale: { ...f.flashSale, enabled: !f.flashSale?.enabled } })}
              style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative', background: f.flashSale?.enabled ? '#2ecc71' : '#444' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: f.flashSale?.enabled ? 19 : 3, transition: 'left .2s' }} />
            </button>
          </div>
          {f.flashSale?.enabled && <input type="datetime-local" value={f.flashSale?.endTime || ''} onChange={e => setF({ ...f, flashSale: { ...f.flashSale, endTime: e.target.value } })} style={{ ...inp, colorScheme: 'dark' }} />}

          {label('🛡️ ข้อความรับประกัน')}<input value={f.guarantee || ''} onChange={e => setF({ ...f, guarantee: e.target.value })} style={inp} />

          <button onClick={doSave} disabled={saving}
            style={{ width: '100%', padding: '14px 0', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, #c9953c, ${gold})`, color: bg, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 18 }}>
            {saving ? 'กำลังบันทึก...' : '💾 บันทึกทั้งหมด'}
          </button>
        </div>
      )}

      {/* ═══ ORDERS ═══ */}
      {tab === 'orders' && (
        <div>
          {orders.length === 0 && <p style={{ color: `${sub}44`, textAlign: 'center', padding: 30 }}>ยังไม่มีออเดอร์</p>}
          {orders.map(o => (
            <div key={o.id} style={{ background: card, borderRadius: 12, padding: 12, marginBottom: 6, border: `1px solid ${gold}10` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: `${sub}44` }}>#{o.id.slice(0, 8)}</span>
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, background: statusC[o.status] + '22', color: statusC[o.status], fontWeight: 600 }}>{statusL[o.status]}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{o.customer_name}</div>
              <div style={{ fontSize: 10, color: `${sub}77` }}>📞 {o.customer_tel} · 📦 {o.package_name}</div>
              <div style={{ fontSize: 10, color: `${sub}55` }}>📍 {o.customer_addr}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', gap: 4 }}>
                <span style={{ fontWeight: 700, color: gold, fontSize: 14 }}>฿{(o.total || 0).toLocaleString()}</span>
                <div style={{ display: 'flex', gap: 2 }}>
                  {['pending', 'shipped', 'done', 'cancel'].map(st => (
                    <button key={st} onClick={() => handleStatus(o.id, st)}
                      style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, border: o.status === st ? `1px solid ${statusC[st]}` : '1px solid #e0c09710', background: o.status === st ? statusC[st] + '33' : 'transparent', color: o.status === st ? statusC[st] : `${sub}33`, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {statusL[st]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ CUSTOMERS ═══ */}
      {tab === 'customers' && (
        <div>
          <div onClick={() => fileRef.current?.click()} style={{ background: card, borderRadius: 12, padding: 16, marginBottom: 10, textAlign: 'center', cursor: 'pointer', border: `2px dashed ${gold}33` }}>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { handleCSV(e.target.files[0]); e.target.value = ''; }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: gold }}>📄 Import CSV</div>
          </div>
          {customers.length > 0 && <input placeholder="🔍 ค้นหา..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, marginBottom: 8 }} />}
          {customers.filter(c => !search || JSON.stringify(c.data).toLowerCase().includes(search.toLowerCase())).map(c => (
            <div key={c.id} style={{ background: card, borderRadius: 10, padding: 10, marginBottom: 4, border: `1px solid ${gold}10` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{c.data?.['ชื่อ'] || c.data?.name || 'ไม่มีชื่อ'}</span>
                <button onClick={async () => { await deleteCustomer(c.id); setCusts(customers.filter(x => x.id !== c.id)); }} style={{ background: 'none', border: 'none', color: '#e74c3c33', fontSize: 10, cursor: 'pointer' }}>✕</button>
              </div>
              {c.data?.['เบอร์โทร'] && <div style={{ fontSize: 10, color: `${sub}66` }}>📞 {c.data['เบอร์โทร']}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
