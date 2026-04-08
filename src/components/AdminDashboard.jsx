import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPages, createPage, deletePage, getAllOrders, getParcels, createParcelFromOrder, updateParcelFlash, flashCreateOrder, flashGetLabel, flashTracking, updateOrderStatus } from '../lib/supabase';
import { DEFAULT_SETTINGS } from '../lib/defaults';

const blue = '#2e86de', green = '#27ae60', red = '#e74c3c', bg = '#f0f2f5', flash = '#ffd400';
const statusC = { pending: '#f39c12', shipped: '#3498db', done: '#27ae60', cancel: '#e74c3c', created: '#9b59b6', shipping: '#3498db', delivered: '#27ae60', returned: '#e67e22' };
const statusL = { pending: 'รอจัดการ', shipped: 'ส่งแล้ว', done: 'สำเร็จ', cancel: 'ยกเลิก' };
const parcelStatusL = { pending: 'รอสร้างเลข', created: 'สร้างเลขแล้ว', shipping: 'กำลังส่ง', delivered: 'ส่งสำเร็จ', returned: 'ตีกลับ', cancel: 'ยกเลิก' };
const inp = { width: '100%', boxSizing: 'border-box', background: '#fff', border: '1.5px solid #ddd', borderRadius: 8, padding: '11px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit', color: '#333' };
const btnS = (bg, c = '#fff') => ({ background: bg, color: c, border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' });

const DEFAULT_SENDER = { name: '', phone: '', address: '', postal: '' };

export default function AdminDashboard() {
  const nav = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [pass, setPass] = useState('');
  const [pages, setPages] = useState([]);
  const [orders, setOrders] = useState([]);
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', slug: '' });
  const [tab, setTab] = useState('pages');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [trackModal, setTrackModal] = useState(null);
  const [senderForm, setSenderForm] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sp_sender') || 'null') || DEFAULT_SENDER; } catch { return DEFAULT_SENDER; }
  });
  const [showSender, setShowSender] = useState(false);
  const [parcelFilter, setParcelFilter] = useState('all');

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [p, o, pc] = await Promise.all([getPages(), getAllOrders(), getParcels().catch(() => [])]);
    setPages(p); setOrders(o); setParcels(pc); setLoading(false);
  }, []);

  useEffect(() => { if (authed) loadAll(); }, [authed, loadAll]);

  const saveSender = () => {
    localStorage.setItem('sp_sender', JSON.stringify(senderForm));
    showToast('✅ บันทึกข้อมูลผู้ส่งแล้ว');
    setShowSender(false);
  };

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

  // ── Flash Express ──
  const handleCreateParcel = async (order) => {
    setBusy(b => ({ ...b, [order.id]: true }));
    try {
      await createParcelFromOrder(order, order.page_id);
      showToast('✅ สร้าง Parcel แล้ว');
      loadAll();
    } catch (e) { showToast('❌ ' + e.message); }
    setBusy(b => ({ ...b, [order.id]: false }));
  };

  const handleFlashCreate = async (parcel) => {
    if (!senderForm.name || !senderForm.phone) {
      showToast('⚠️ กรุณาตั้งค่าข้อมูลผู้ส่งก่อน');
      setShowSender(true);
      return;
    }
    setBusy(b => ({ ...b, [`flash_${parcel.id}`]: true }));
    try {
      const result = await flashCreateOrder(parcel, senderForm);
      if (result.code === 1 && result.data) {
        const pno = result.data.pno;
        const sortCode = result.data.sortCode || '';
        const dstStore = result.data.dstStoreName || '';
        await updateParcelFlash(parcel.id, pno, sortCode, dstStore, result.data);
        showToast(`✅ ได้เลข ${pno}`);
        loadAll();
      } else {
        showToast(`❌ Flash: ${result.message || JSON.stringify(result)}`);
      }
    } catch (e) { showToast('❌ ' + e.message); }
    setBusy(b => ({ ...b, [`flash_${parcel.id}`]: false }));
  };

  const handleBulkFlash = async () => {
    const targets = parcels.filter(p => selected.has(p.id) && p.status === 'pending');
    if (!targets.length) return showToast('ไม่มีรายการที่รอสร้างเลข');
    if (!senderForm.name || !senderForm.phone) { showToast('⚠️ ตั้งค่าผู้ส่งก่อน'); setShowSender(true); return; }
    for (const p of targets) {
      await handleFlashCreate(p);
    }
    setSelected(new Set());
  };

  const handlePrintLabel = async (pno) => {
    setBusy(b => ({ ...b, [`label_${pno}`]: true }));
    try {
      const result = await flashGetLabel(pno);
      if (result.code === 1 && result.data?.labelUrl) {
        window.open(result.data.labelUrl, '_blank');
      } else if (result.data?.labelContent) {
        const blob = new Blob([Uint8Array.from(atob(result.data.labelContent), c => c.charCodeAt(0))], { type: 'application/pdf' });
        window.open(URL.createObjectURL(blob), '_blank');
      } else {
        showToast('❌ ' + (result.message || 'ไม่พบ label'));
      }
    } catch (e) { showToast('❌ ' + e.message); }
    setBusy(b => ({ ...b, [`label_${pno}`]: false }));
  };

  const handleTracking = async (pno) => {
    setTrackModal({ pno, loading: true, data: null });
    try {
      const result = await flashTracking(pno);
      setTrackModal({ pno, loading: false, data: result.data || result });
    } catch (e) {
      setTrackModal({ pno, loading: false, data: { error: e.message } });
    }
  };

  const totalRev = orders.filter(o => o.status !== 'cancel').reduce((s, o) => s + (o.total || 0), 0);
  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const flashCount = parcels.filter(p => p.flash_pno).length;
  const filteredParcels = parcelFilter === 'all' ? parcels : parcels.filter(p => p.status === parcelFilter);

  if (!authed) return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Noto Sans Thai', sans-serif" }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 32px', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,.08)', border: '1px solid #eee', width: 340 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏪</div>
        <h2 style={{ color: blue, marginBottom: 20, fontSize: 20 }}>SalePage Admin</h2>
        <input type="password" placeholder="รหัสผ่าน" value={pass} onChange={e => setPass(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') pass === 'admin1234' ? setAuthed(true) : showToast('รหัสไม่ถูกต้อง'); }}
          style={{ ...inp, marginBottom: 12, textAlign: 'center' }} />
        <button onClick={() => pass === 'admin1234' ? setAuthed(true) : showToast('รหัสไม่ถูกต้อง')}
          style={{ ...btnS(blue), width: '100%', padding: '12px 0', fontSize: 15 }}>เข้าสู่ระบบ</button>
        <p style={{ fontSize: 11, color: '#ccc', marginTop: 16 }}>รหัส: admin1234</p>
        {toast && <div style={{ marginTop: 12, color: red, fontSize: 13 }}>{toast}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'Noto Sans Thai', sans-serif" }}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: green, color: '#fff', padding: '10px 24px', borderRadius: 30, zIndex: 999, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,.15)' }}>{toast}</div>}

      <div style={{ background: '#fff', borderBottom: '1px solid #e0e0e0', padding: '14px 20px', position: 'sticky', top: 0, zIndex: 80 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 900, margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: blue }}>🏪 SalePage Admin</h1>
          <button onClick={() => setAuthed(false)} style={{ background: '#fff', color: '#999', border: '1px solid #ddd', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>ออกจากระบบ</button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { l: 'เซลเพจ', v: pages.length, c: '#1abc9c', icon: '📄' },
            { l: 'ยอดขาย', v: `฿${totalRev.toLocaleString()}`, c: green, icon: '💰' },
            { l: 'ออเดอร์', v: orders.length, c: blue, icon: '📦' },
            { l: 'รอจัดการ', v: pendingCount, c: '#f39c12', icon: '⏳' },
            { l: 'เลข TH', v: flashCount, c: '#9b59b6', icon: '⚡' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '14px 10px', border: '1px solid #eee', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#999', fontWeight: 600, marginBottom: 3 }}>{s.icon} {s.l}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.c }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderRadius: 10, overflow: 'hidden', border: '1px solid #ddd' }}>
          {[['pages', '📄 เซลเพจ'], ['orders', '📦 ออเดอร์'], ['shipping', '⚡ จัดส่ง']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ flex: 1, padding: '12px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                background: tab === id ? (id === 'shipping' ? '#333' : blue) : '#fff', color: tab === id ? (id === 'shipping' ? flash : '#fff') : '#666' }}>{label}</button>
          ))}
        </div>

        {/* ═══ PAGES TAB ═══ */}
        {tab === 'pages' && (<div>
          <button onClick={() => setShowNew(!showNew)}
            style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: blue, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14, boxShadow: '0 2px 8px rgba(46,134,222,.3)' }}>
            ➕ สร้างเซลเพจใหม่
          </button>
          {showNew && (
            <div style={{ background: '#fff', borderRadius: 14, padding: 20, marginBottom: 14, border: '1px solid #ddd' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#333', marginBottom: 14 }}>สร้างเซลเพจใหม่</div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 3 }}>ชื่อสินค้า</div>
                <input value={newForm.name} onChange={e => setNewForm({ ...newForm, name: e.target.value })} placeholder="เช่น ครีมโสม" style={inp} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 3 }}>URL slug</div>
                <input value={newForm.slug} onChange={e => setNewForm({ ...newForm, slug: e.target.value })} placeholder="เช่น ginseng-cream" style={inp} />
                {newForm.slug && <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>🔗 /{newForm.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowNew(false)} style={{ ...btnS('#fff', '#999'), flex: 1, border: '1px solid #ddd' }}>ยกเลิก</button>
                <button onClick={handleCreate} style={{ ...btnS(green), flex: 1 }}>✅ สร้าง</button>
              </div>
            </div>
          )}
          {loading && <div style={{ textAlign: 'center', padding: 40, color: '#ccc' }}>กำลังโหลด...</div>}
          {pages.map(pg => {
            const pgOrders = orders.filter(o => o.page_id === pg.id);
            const pgRev = pgOrders.filter(o => o.status !== 'cancel').reduce((s, o) => s + (o.total || 0), 0);
            const pageUrl = `${window.location.origin}${import.meta.env.BASE_URL || '/'}#/${pg.slug}`;
            return (
              <div key={pg.id} style={{ background: '#fff', borderRadius: 14, padding: 18, marginBottom: 10, border: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: '#333' }}>{pg.name}</span>
                      <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, fontWeight: 600, background: pg.is_active ? '#e8f5e9' : '#ffebee', color: pg.is_active ? green : red }}>{pg.is_active ? '✅ Active' : '⏸ Off'}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#bbb', marginBottom: 8 }}>🔗 /{pg.slug}</div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                      <span style={{ color: blue }}>📦 {pgOrders.length}</span>
                      <span style={{ color: green }}>💰 ฿{pgRev.toLocaleString()}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <a href={pageUrl} target="_blank" style={{ ...btnS('#fff3e0', '#e65100'), textDecoration: 'none' }}>👁</a>
                    <button onClick={() => nav(`/admin/${pg.id}`)} style={btnS(blue)}>✏️ จัดการ</button>
                    <button onClick={() => handleDelete(pg.id, pg.name)} style={btnS('#ffebee', red)}>🗑</button>
                  </div>
                </div>
              </div>
            );
          })}
          {!loading && pages.length === 0 && <div style={{ textAlign: 'center', padding: 50, color: '#ccc' }}><div style={{ fontSize: 48, marginBottom: 12 }}>📄</div><div style={{ fontSize: 16, fontWeight: 600 }}>ยังไม่มีเซลเพจ</div></div>}
        </div>)}

        {/* ═══ ORDERS TAB ═══ */}
        {tab === 'orders' && (<div>
          {orders.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#ccc' }}>ยังไม่มีออเดอร์</div>}
          {orders.map(o => {
            const hasParcel = parcels.some(p => p.order_id === o.id);
            return (
              <div key={o.id} style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, border: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: '#ccc' }}>#{o.id.slice(0, 8)}</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {o.flash_pno && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: '#f5f0ff', color: '#9b59b6', fontWeight: 600 }}>⚡ {o.flash_pno}</span>}
                    <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, background: statusC[o.status] + '18', color: statusC[o.status], fontWeight: 600 }}>{statusL[o.status]}</span>
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>{o.customer_name}</div>
                <div style={{ fontSize: 12, color: '#888' }}>📞 {o.customer_tel} · 📦 {o.package_name}</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{o.customer_addr}</div>
                {o.sp_pages && <div style={{ fontSize: 11, color: blue, marginTop: 2 }}>📄 {o.sp_pages.name}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <span style={{ fontWeight: 700, color: green, fontSize: 16 }}>฿{(o.total || 0).toLocaleString()}</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {!hasParcel && o.status === 'pending' && (
                      <button onClick={() => handleCreateParcel(o)} disabled={busy[o.id]}
                        style={{ ...btnS('#333', flash), fontSize: 11, opacity: busy[o.id] ? 0.5 : 1 }}>
                        {busy[o.id] ? '...' : '⚡ สร้าง Parcel'}
                      </button>
                    )}
                    <span style={{ fontSize: 10, color: '#ccc' }}>{new Date(o.created_at).toLocaleString('th-TH')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>)}

        {/* ═══ SHIPPING TAB ═══ */}
        {tab === 'shipping' && (<div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={() => setShowSender(!showSender)} style={{ ...btnS('#fff', '#666'), border: '1px solid #ddd', flex: 1, textAlign: 'left' }}>
              ⚙️ ผู้ส่ง: {senderForm.name || '(ยังไม่ตั้ง)'}
            </button>
            <button onClick={() => loadAll()} style={{ ...btnS('#fff', '#666'), border: '1px solid #ddd' }}>🔄</button>
          </div>

          {showSender && (
            <div style={{ background: '#fffde7', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #f9e44c' }}>
              <div style={{ fontWeight: 700, marginBottom: 10, color: '#333' }}>📮 ข้อมูลผู้ส่ง</div>
              {[['name', 'ชื่อผู้ส่ง'], ['phone', 'เบอร์โทร'], ['address', 'ที่อยู่เต็ม'], ['postal', 'รหัสไปรษณีย์']].map(([k, label]) => (
                <div key={k} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{label}</div>
                  <input value={senderForm[k]} onChange={e => setSenderForm({ ...senderForm, [k]: e.target.value })} style={inp} />
                </div>
              ))}
              <button onClick={saveSender} style={{ ...btnS(green), width: '100%', marginTop: 4 }}>💾 บันทึก</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {[['all', 'ทั้งหมด'], ['pending', '🟡 รอสร้าง'], ['created', '🟣 สร้างแล้ว'], ['shipping', '🔵 กำลังส่ง'], ['delivered', '🟢 สำเร็จ']].map(([v, l]) => (
              <button key={v} onClick={() => setParcelFilter(v)}
                style={{ ...btnS(parcelFilter === v ? '#333' : '#fff', parcelFilter === v ? flash : '#999'), border: parcelFilter !== v ? '1px solid #ddd' : 'none', fontSize: 12, padding: '6px 12px' }}>
                {l} ({v === 'all' ? parcels.length : parcels.filter(p => p.status === v).length})
              </button>
            ))}
          </div>

          {selected.size > 0 && (
            <div style={{ background: '#333', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: flash, fontSize: 13, fontWeight: 600 }}>✓ เลือก {selected.size} รายการ</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleBulkFlash} style={{ ...btnS(flash, '#333'), fontSize: 12 }}>⚡ สร้างเลข TH ทั้งหมด</button>
                <button onClick={() => setSelected(new Set())} style={{ ...btnS('#555', '#ccc'), fontSize: 12 }}>✕</button>
              </div>
            </div>
          )}

          {filteredParcels.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#ccc' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>ไม่มีรายการ — ไปแท็บ "ออเดอร์" กด ⚡ สร้าง Parcel</div>}

          {filteredParcels.map(p => {
            const o = p.sp_orders || {};
            const isChecked = selected.has(p.id);
            return (
              <div key={p.id} style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, border: isChecked ? `2px solid ${flash}` : '1px solid #eee' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={isChecked} onChange={() => {
                    const s = new Set(selected);
                    isChecked ? s.delete(p.id) : s.add(p.id);
                    setSelected(s);
                  }} style={{ marginTop: 4, accentColor: flash }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: '#999', fontWeight: 600 }}>{p.parcel_no}</span>
                      <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, fontWeight: 600, background: (statusC[p.status] || '#999') + '18', color: statusC[p.status] || '#999' }}>
                        {parcelStatusL[p.status] || p.status}
                      </span>
                    </div>
                    {p.flash_pno && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, background: '#f5f0ff', padding: '6px 10px', borderRadius: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: '#7c3aed', letterSpacing: 1 }}>⚡ {p.flash_pno}</span>
                        <button onClick={() => { navigator.clipboard.writeText(p.flash_pno); showToast('📋 คัดลอกแล้ว'); }}
                          style={{ ...btnS('#e8e0ff', '#7c3aed'), fontSize: 10, padding: '3px 8px' }}>📋</button>
                        {p.flash_sort_code && <span style={{ fontSize: 10, color: '#999' }}>SC: {p.flash_sort_code}</span>}
                      </div>
                    )}
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>{p.receiver_name || o.customer_name}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>📞 {p.receiver_phone || o.customer_tel}</div>
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{p.receiver_address || o.customer_addr}</div>
                    {p.cod_amount > 0 && <div style={{ fontSize: 12, color: red, fontWeight: 600, marginTop: 4 }}>💵 COD ฿{Number(p.cod_amount).toLocaleString()}</div>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      {p.status === 'pending' && !p.flash_pno && (
                        <button onClick={() => handleFlashCreate(p)} disabled={busy[`flash_${p.id}`]}
                          style={{ ...btnS('#333', flash), fontSize: 12, opacity: busy[`flash_${p.id}`] ? 0.5 : 1 }}>
                          {busy[`flash_${p.id}`] ? '⏳ กำลังสร้าง...' : '⚡ สร้างเลข TH'}
                        </button>
                      )}
                      {p.flash_pno && (<>
                        <button onClick={() => handlePrintLabel(p.flash_pno)} disabled={busy[`label_${p.flash_pno}`]}
                          style={{ ...btnS('#1a73e8'), fontSize: 12 }}>{busy[`label_${p.flash_pno}`] ? '...' : '🏷 ลาเบล'}</button>
                        <button onClick={() => handleTracking(p.flash_pno)}
                          style={{ ...btnS('#fff', '#666'), fontSize: 12, border: '1px solid #ddd' }}>📍 Tracking</button>
                      </>)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>)}
      </div>

      {/* Tracking Modal */}
      {trackModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setTrackModal(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 500, width: '100%', maxHeight: '80vh', overflow: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#333' }}>📍 Tracking</div>
                <div style={{ fontSize: 14, color: '#7c3aed', fontWeight: 600 }}>{trackModal.pno}</div>
              </div>
              <button onClick={() => setTrackModal(null)} style={{ ...btnS('#f5f5f5', '#999'), fontSize: 16 }}>✕</button>
            </div>
            {trackModal.loading && <div style={{ textAlign: 'center', padding: 30, color: '#ccc' }}>⏳ กำลังโหลด...</div>}
            {!trackModal.loading && trackModal.data && (<div>
              {trackModal.data.stateText && (
                <div style={{ background: '#f5f0ff', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#7c3aed' }}>{trackModal.data.stateText}</span>
                </div>
              )}
              {(trackModal.data.routes || []).map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: i === 0 ? '#7c3aed' : '#ddd', flexShrink: 0 }} />
                    {i < (trackModal.data.routes.length - 1) && <div style={{ width: 2, flex: 1, background: '#eee' }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: 8 }}>
                    <div style={{ fontSize: 13, color: '#333' }}>{r.message}</div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{r.routedAt ? new Date(r.routedAt * 1000).toLocaleString('th-TH') : ''}</div>
                  </div>
                </div>
              ))}
              {trackModal.data.error && <div style={{ color: red, fontSize: 13 }}>❌ {trackModal.data.error}</div>}
            </div>)}
          </div>
        </div>
      )}
    </div>
  );
}
