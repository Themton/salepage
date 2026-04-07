import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPages, createPage, deletePage, getAllOrders } from '../lib/supabase';
import { DEFAULT_SETTINGS } from '../lib/defaults';

const bg = '#0d0d1a', card = '#1a1a2e', gold = '#e0c097', sub = '#c4b49a';
const statusC = { pending: '#f39c12', shipped: '#3498db', done: '#2ecc71', cancel: '#e74c3c' };
const statusL = { pending: 'รอ', shipped: 'ส่งแล้ว', done: 'สำเร็จ', cancel: 'ยกเลิก' };

export default function AdminDashboard() {
  const nav = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [pass, setPass] = useState('');
  const [pages, setPages] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', slug: '' });
  const [tab, setTab] = useState('pages');
  const [toast, setToast] = useState('');

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadAll = async () => {
    setLoading(true);
    const [p, o] = await Promise.all([getPages(), getAllOrders()]);
    setPages(p); setOrders(o);
    setLoading(false);
  };

  useEffect(() => { if (authed) loadAll(); }, [authed]);

  const handleCreate = async () => {
    if (!newForm.name || !newForm.slug) return showToast('กรุณากรอกให้ครบ');
    const slug = newForm.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    try {
      await createPage(slug, newForm.name, DEFAULT_SETTINGS);
      showToast('✅ สร้างเซลเพจสำเร็จ');
      setShowNew(false); setNewForm({ name: '', slug: '' });
      loadAll();
    } catch (e) { showToast('❌ ' + (e.message || 'เกิดข้อผิดพลาด')); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`ลบเซลเพจ "${name}" ?\nออเดอร์ทั้งหมดจะถูกลบด้วย`)) return;
    try { await deletePage(id); showToast('ลบแล้ว'); loadAll(); } catch (e) { showToast('ลบไม่สำเร็จ'); }
  };

  const totalRev = orders.filter(o => o.status !== 'cancel').reduce((s, o) => s + (o.total || 0), 0);
  const pendingCount = orders.filter(o => o.status === 'pending').length;

  // Login
  if (!authed) return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Noto Sans Thai', sans-serif" }}>
      <div style={{ textAlign: 'center', color: '#f0e6d3' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🏪</div>
        <h2 style={{ color: gold, marginBottom: 16, fontSize: 20 }}>SalePage Admin</h2>
        <input type="password" placeholder="รหัสผ่าน" value={pass} onChange={e => setPass(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') pass === 'admin1234' ? setAuthed(true) : showToast('รหัสไม่ถูกต้อง'); }}
          style={{ background: card, border: `1px solid ${gold}33`, borderRadius: 10, padding: '12px 18px', color: '#f0e6d3', fontSize: 14, width: 220, outline: 'none', fontFamily: 'inherit', marginBottom: 12, textAlign: 'center' }} />
        <br />
        <button onClick={() => pass === 'admin1234' ? setAuthed(true) : showToast('รหัสไม่ถูกต้อง')}
          style={{ background: `linear-gradient(135deg, #c9953c, ${gold})`, color: bg, border: 'none', borderRadius: 10, padding: '10px 32px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>เข้าสู่ระบบ</button>
        <p style={{ fontSize: 10, color: '#c4b49a44', marginTop: 14 }}>รหัส: admin1234</p>
        {toast && <div style={{ marginTop: 16, color: '#e74c3c', fontSize: 13 }}>{toast}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: bg, color: '#f0e6d3', fontFamily: "'Noto Sans Thai', sans-serif", padding: 16 }}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#2d6b45', color: '#fff', padding: '10px 24px', borderRadius: 30, zIndex: 999, fontSize: 14, fontWeight: 600 }}>{toast}</div>}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, color: gold, fontSize: 20 }}>🏪 SalePage Admin</h1>
        <button onClick={() => setAuthed(false)} style={{ background: '#e74c3c22', color: '#e74c3c', border: '1px solid #e74c3c33', borderRadius: 8, padding: '6px 14px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>ออกจากระบบ</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: 20 }}>
        {[
          { l: 'เซลเพจ', v: pages.length, c: '#1abc9c' },
          { l: 'ยอดขายรวม', v: `฿${totalRev.toLocaleString()}`, c: '#2ecc71' },
          { l: 'ออเดอร์ทั้งหมด', v: orders.length, c: '#3498db' },
          { l: 'รอจัดการ', v: pendingCount, c: '#f39c12' },
        ].map((s, i) => (
          <div key={i} style={{ background: card, borderRadius: 12, padding: '14px 10px', textAlign: 'center', border: '1px solid #e0c09712' }}>
            <div style={{ fontSize: 9, color: '#c4b49a77', fontWeight: 600, marginBottom: 2 }}>{s.l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[['pages', '📄 เซลเพจ'], ['orders', '📦 ออเดอร์ทั้งหมด']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ background: tab === id ? gold : card, color: tab === id ? bg : sub, border: `1px solid ${gold}22`, borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {label}
          </button>
        ))}
      </div>

      {/* PAGES TAB */}
      {tab === 'pages' && (
        <div>
          <button onClick={() => setShowNew(!showNew)}
            style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, #c9953c, ${gold})`, color: bg, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14 }}>
            ➕ สร้างเซลเพจใหม่
          </button>

          {showNew && (
            <div style={{ background: card, borderRadius: 14, padding: 18, marginBottom: 14, border: `1px solid ${gold}22` }} className="fade-in">
              <h3 style={{ color: gold, margin: '0 0 12px', fontSize: 15 }}>สร้างเซลเพจใหม่</h3>
              <input value={newForm.name} onChange={e => setNewForm({ ...newForm, name: e.target.value })} placeholder="ชื่อสินค้า เช่น ครีมโสม"
                style={{ width: '100%', boxSizing: 'border-box', background: bg, border: `1px solid ${gold}22`, borderRadius: 8, padding: '10px 14px', color: '#f0e6d3', fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 8 }} />
              <input value={newForm.slug} onChange={e => setNewForm({ ...newForm, slug: e.target.value })} placeholder="URL slug เช่น ginseng-cream (ภาษาอังกฤษ)"
                style={{ width: '100%', boxSizing: 'border-box', background: bg, border: `1px solid ${gold}22`, borderRadius: 8, padding: '10px 14px', color: '#f0e6d3', fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 8 }} />
              {newForm.slug && <p style={{ fontSize: 11, color: '#c4b49a77', marginBottom: 10 }}>🔗 URL: /{newForm.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowNew(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: `1px solid ${gold}22`, background: card, color: sub, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
                <button onClick={handleCreate} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: `linear-gradient(135deg, #c9953c, ${gold})`, color: bg, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✅ สร้าง</button>
              </div>
            </div>
          )}

          {loading && <p style={{ color: '#c4b49a55', textAlign: 'center', padding: 30 }}>กำลังโหลด...</p>}

          {pages.map(pg => {
            const pgOrders = orders.filter(o => o.page_id === pg.id);
            const pgRev = pgOrders.filter(o => o.status !== 'cancel').reduce((s, o) => s + (o.total || 0), 0);
            return (
              <div key={pg.id} style={{ background: card, borderRadius: 14, padding: 16, marginBottom: 10, border: `1px solid ${gold}12` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{pg.name}</span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: pg.is_active ? '#2ecc7122' : '#e74c3c22', color: pg.is_active ? '#2ecc71' : '#e74c3c', fontWeight: 600 }}>{pg.is_active ? 'Active' : 'Off'}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#c4b49a77', marginBottom: 6 }}>🔗 /{pg.slug}</div>
                    <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
                      <span style={{ color: '#3498db' }}>📦 {pgOrders.length} ออเดอร์</span>
                      <span style={{ color: '#2ecc71' }}>💰 ฿{pgRev.toLocaleString()}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => nav(`/admin/${pg.id}`)}
                      style={{ background: `${gold}22`, color: gold, border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✏️ แก้ไข</button>
                    <button onClick={() => handleDelete(pg.id, pg.name)}
                      style={{ background: '#e74c3c18', color: '#e74c3c', border: 'none', borderRadius: 8, padding: '8px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>🗑</button>
                  </div>
                </div>
              </div>
            );
          })}

          {!loading && pages.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#c4b49a44' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
              <p>ยังไม่มีเซลเพจ — กดสร้างใหม่ด้านบน</p>
            </div>
          )}
        </div>
      )}

      {/* ORDERS TAB */}
      {tab === 'orders' && (
        <div>
          {orders.length === 0 && <p style={{ color: '#c4b49a44', textAlign: 'center', padding: 30 }}>ยังไม่มีออเดอร์</p>}
          {orders.map(o => (
            <div key={o.id} style={{ background: card, borderRadius: 12, padding: 14, marginBottom: 8, border: `1px solid ${gold}12` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#c4b49a44' }}>#{o.id.slice(0, 8)}</span>
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, background: statusC[o.status] + '22', color: statusC[o.status], fontWeight: 600 }}>{statusL[o.status]}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{o.customer_name}</div>
              <div style={{ fontSize: 11, color: '#c4b49a77' }}>📞 {o.customer_tel} · 📦 {o.package_name}</div>
              {o.sp_pages && <div style={{ fontSize: 10, color: gold, marginTop: 2 }}>📄 {o.sp_pages.name}</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <span style={{ fontWeight: 700, color: gold, fontSize: 15 }}>฿{(o.total || 0).toLocaleString()}</span>
                <span style={{ fontSize: 9, color: '#c4b49a44' }}>{new Date(o.created_at).toLocaleString('th-TH')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
