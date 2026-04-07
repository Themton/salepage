import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPages, createPage, deletePage, getAllOrders } from '../lib/supabase';
import { DEFAULT_SETTINGS } from '../lib/defaults';

const blue = '#2e86de', green = '#27ae60', red = '#e74c3c', bg = '#f0f2f5';
const statusC = { pending: '#f39c12', shipped: '#3498db', done: '#27ae60', cancel: '#e74c3c' };
const statusL = { pending: 'รอจัดการ', shipped: 'ส่งแล้ว', done: 'สำเร็จ', cancel: 'ยกเลิก' };
const inp = { width: '100%', boxSizing: 'border-box', background: '#fff', border: '1.5px solid #ddd', borderRadius: 8, padding: '11px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit', color: '#333' };

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
    setPages(p); setOrders(o); setLoading(false);
  };

  useEffect(() => { if (authed) loadAll(); }, [authed]);

  const handleCreate = async () => {
    if (!newForm.name || !newForm.slug) return showToast('กรุณากรอกให้ครบ');
    const slug = newForm.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    try {
      await createPage(slug, newForm.name, DEFAULT_SETTINGS);
      showToast('✅ สร้างเซลเพจสำเร็จ');
      setShowNew(false); setNewForm({ name: '', slug: '' }); loadAll();
    } catch (e) { showToast('❌ ' + (e.message || 'เกิดข้อผิดพลาด')); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`ลบเซลเพจ "${name}" ?\nออเดอร์ทั้งหมดจะถูกลบด้วย`)) return;
    try { await deletePage(id); showToast('ลบแล้ว'); loadAll(); } catch { showToast('ลบไม่สำเร็จ'); }
  };

  const totalRev = orders.filter(o => o.status !== 'cancel').reduce((s, o) => s + (o.total || 0), 0);
  const pendingCount = orders.filter(o => o.status === 'pending').length;

  // ── Login ──
  if (!authed) return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Noto Sans Thai', sans-serif" }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 32px', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,.08)', border: '1px solid #eee', width: 340 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏪</div>
        <h2 style={{ color: blue, marginBottom: 20, fontSize: 20 }}>SalePage Admin</h2>
        <input type="password" placeholder="รหัสผ่าน" value={pass} onChange={e => setPass(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') pass === 'admin1234' ? setAuthed(true) : showToast('รหัสไม่ถูกต้อง'); }}
          style={{ ...inp, marginBottom: 12, textAlign: 'center' }} />
        <button onClick={() => pass === 'admin1234' ? setAuthed(true) : showToast('รหัสไม่ถูกต้อง')}
          style={{ background: blue, color: '#fff', border: 'none', borderRadius: 8, padding: '12px 0', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%', fontSize: 15 }}>เข้าสู่ระบบ</button>
        <p style={{ fontSize: 11, color: '#ccc', marginTop: 16 }}>รหัส: admin1234</p>
        {toast && <div style={{ marginTop: 12, color: red, fontSize: 13 }}>{toast}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'Noto Sans Thai', sans-serif" }}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: green, color: '#fff', padding: '10px 24px', borderRadius: 30, zIndex: 999, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,.15)' }}>{toast}</div>}

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e0e0e0', padding: '14px 20px', position: 'sticky', top: 0, zIndex: 80 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 800, margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: blue }}>🏪 SalePage Admin</h1>
          <button onClick={() => setAuthed(false)} style={{ background: '#fff', color: '#999', border: '1px solid #ddd', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>ออกจากระบบ</button>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: 16 }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { l: 'เซลเพจ', v: pages.length, c: '#1abc9c', icon: '📄' },
            { l: 'ยอดขายรวม', v: `฿${totalRev.toLocaleString()}`, c: green, icon: '💰' },
            { l: 'ออเดอร์ทั้งหมด', v: orders.length, c: blue, icon: '📦' },
            { l: 'รอจัดการ', v: pendingCount, c: '#f39c12', icon: '⏳' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 14px', border: '1px solid #eee', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#999', fontWeight: 600, marginBottom: 4 }}>{s.icon} {s.l}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.c }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderRadius: 10, overflow: 'hidden', border: '1px solid #ddd' }}>
          {[['pages', '📄 เซลเพจ'], ['orders', '📦 ออเดอร์ทั้งหมด']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ flex: 1, padding: '12px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                background: tab === id ? blue : '#fff', color: tab === id ? '#fff' : '#666' }}>{label}</button>
          ))}
        </div>

        {/* ═══ PAGES TAB ═══ */}
        {tab === 'pages' && (
          <div>
            <button onClick={() => setShowNew(!showNew)}
              style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: blue, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14, boxShadow: '0 2px 8px rgba(46,134,222,.3)' }}>
              ➕ สร้างเซลเพจใหม่
            </button>

            {showNew && (
              <div className="fade-in" style={{ background: '#fff', borderRadius: 14, padding: 20, marginBottom: 14, border: '1px solid #ddd', boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#333', marginBottom: 14 }}>สร้างเซลเพจใหม่</div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 3 }}>ชื่อสินค้า</div>
                  <input value={newForm.name} onChange={e => setNewForm({ ...newForm, name: e.target.value })} placeholder="เช่น ครีมโสม" style={inp} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 3 }}>URL slug (ภาษาอังกฤษ)</div>
                  <input value={newForm.slug} onChange={e => setNewForm({ ...newForm, slug: e.target.value })} placeholder="เช่น ginseng-cream" style={inp} />
                  {newForm.slug && <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>🔗 ลิงค์: .../#/{newForm.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowNew(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#999', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
                  <button onClick={handleCreate} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: green, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✅ สร้าง</button>
                </div>
              </div>
            )}

            {loading && <div style={{ textAlign: 'center', padding: 40, color: '#ccc' }}>กำลังโหลด...</div>}

            {pages.map(pg => {
              const pgOrders = orders.filter(o => o.page_id === pg.id);
              const pgRev = pgOrders.filter(o => o.status !== 'cancel').reduce((s, o) => s + (o.total || 0), 0);
              const pageUrl = `${window.location.origin}${import.meta.env.BASE_URL || '/'}#/${pg.slug}`;
              return (
                <div key={pg.id} style={{ background: '#fff', borderRadius: 14, padding: 18, marginBottom: 10, border: '1px solid #eee', boxShadow: '0 1px 4px rgba(0,0,0,.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: '#333' }}>{pg.name}</span>
                        <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, fontWeight: 600,
                          background: pg.is_active ? '#e8f5e9' : '#ffebee',
                          color: pg.is_active ? green : red }}>{pg.is_active ? '✅ Active' : '⏸ Off'}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#bbb', marginBottom: 8 }}>🔗 /{pg.slug}</div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                        <span style={{ color: blue }}>📦 {pgOrders.length} ออเดอร์</span>
                        <span style={{ color: green }}>💰 ฿{pgRev.toLocaleString()}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <a href={pageUrl} target="_blank" style={{ background: '#fff3e0', color: '#e65100', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>👁</a>
                      <button onClick={() => nav(`/admin/${pg.id}`)}
                        style={{ background: blue, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✏️ จัดการ</button>
                      <button onClick={() => handleDelete(pg.id, pg.name)}
                        style={{ background: '#ffebee', color: red, border: 'none', borderRadius: 8, padding: '8px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>🗑</button>
                    </div>
                  </div>
                </div>
              );
            })}

            {!loading && pages.length === 0 && (
              <div style={{ textAlign: 'center', padding: 50, color: '#ccc' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>ยังไม่มีเซลเพจ</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>กดปุ่มด้านบนเพื่อสร้างใหม่</div>
              </div>
            )}
          </div>
        )}

        {/* ═══ ORDERS TAB ═══ */}
        {tab === 'orders' && (
          <div>
            {orders.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#ccc' }}>ยังไม่มีออเดอร์</div>}
            {orders.map(o => (
              <div key={o.id} style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, border: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: '#ccc' }}>#{o.id.slice(0, 8)}</span>
                  <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, background: statusC[o.status] + '18', color: statusC[o.status], fontWeight: 600 }}>{statusL[o.status]}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>{o.customer_name}</div>
                <div style={{ fontSize: 12, color: '#888' }}>📞 {o.customer_tel} · 📦 {o.package_name}</div>
                {o.sp_pages && <div style={{ fontSize: 11, color: blue, marginTop: 2 }}>📄 {o.sp_pages.name}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <span style={{ fontWeight: 700, color: green, fontSize: 16 }}>฿{(o.total || 0).toLocaleString()}</span>
                  <span style={{ fontSize: 10, color: '#ccc' }}>{new Date(o.created_at).toLocaleString('th-TH')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
