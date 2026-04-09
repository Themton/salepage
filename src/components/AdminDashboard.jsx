import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPages, createPage, deletePage, getAllOrders, updateOrderStatus, supabase } from '../lib/supabase';
import { DEFAULT_SETTINGS } from '../lib/defaults';

const blue = '#2e86de', green = '#27ae60', red = '#e74c3c', bg = '#f5f6fa';
const statusC = { pending: '#f39c12', shipped: '#3498db', done: '#27ae60', cancel: '#e74c3c', exported: '#8e44ad' };
const statusL = { pending: 'รอจัดการ', shipped: 'ส่งแล้ว', done: 'สำเร็จ', cancel: 'ยกเลิก', exported: 'Export แล้ว' };
const inp = { boxSizing: 'border-box', background: '#fff', border: '1.5px solid #ddd', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit', color: '#333' };
const btnS = (b, c = '#fff') => ({ background: b, color: c, border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' });
const today = () => new Date().toISOString().slice(0, 10);

export default function AdminDashboard() {
  const nav = useNavigate();
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('sp_authed') === '1');
  const [pass, setPass] = useState('');

  const doLogin = () => {
    if (pass === 'admin1234') { setAuthed(true); sessionStorage.setItem('sp_authed', '1'); }
    else showToast('รหัสไม่ถูกต้อง');
  };
  const doLogout = () => { setAuthed(false); sessionStorage.removeItem('sp_authed'); };
  const [pages, setPages] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', slug: '' });
  const [tab, setTab] = useState('pages');
  const [toast, setToast] = useState('');
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [pageFilter, setPageFilter] = useState('all');

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
    if (!confirm(`ลบเซลเพจ "${name}" ?`)) return;
    try { await deletePage(id); showToast('ลบแล้ว'); loadAll(); } catch { showToast('ลบไม่สำเร็จ'); }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await supabase.from('sp_orders').update({ status: newStatus }).eq('id', id);
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
      showToast('✅ เปลี่ยนสถานะแล้ว');
    } catch { showToast('❌ เปลี่ยนสถานะไม่สำเร็จ'); }
  };

  const bulkSetExported = async () => {
    const ids = [...selected];
    if (!ids.length) return showToast('เลือกรายการก่อน');
    for (const id of ids) {
      await supabase.from('sp_orders').update({ status: 'exported' }).eq('id', id);
    }
    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, status: 'exported' } : o));
    setSelected(new Set());
    showToast(`✅ เปลี่ยนสถานะ ${ids.length} รายการเป็น Export แล้ว`);
  };

  // Filters
  const filteredOrders = orders.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (pageFilter !== 'all' && o.page_id !== pageFilter) return false;
    if (dateFrom) { if (new Date(o.created_at) < new Date(dateFrom)) return false; }
    if (dateTo) { if (new Date(o.created_at) > new Date(dateTo + 'T23:59:59')) return false; }
    if (search) {
      const s = search.toLowerCase();
      if (!(o.customer_name||'').toLowerCase().includes(s) && !(o.customer_tel||'').includes(s) && !(o.customer_addr||'').toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const filteredRev = filteredOrders.filter(o => o.status !== 'cancel').reduce((s, o) => s + (o.total || 0), 0);
  const totalRev = orders.filter(o => o.status !== 'cancel').reduce((s, o) => s + (o.total || 0), 0);
  const pendingCount = orders.filter(o => o.status === 'pending').length;

  // Export
  const exportProShip = (onlySelected) => {
    const rows = (onlySelected ? filteredOrders.filter(o => selected.has(o.id)) : filteredOrders);
    if (!rows.length) return showToast('ไม่มีรายการ');
    const headers = ['MobileNo*\nเบอร์มือถือ','Name\nชื่อ','Address\nที่อยู่','SubDistrict\nตำบล','District\nอำเภอ','ZIP\nรหัส ปณ.','Customer FB/Line\nเฟส/ไลน์ลูกค้า','SalesChannel\nช่องทางจำหน่าย','SalesPerson\nชื่อแอดมิน','SalePrice\nราคาขาย','COD*\nยอดเก็บเงินปลายทาง','Remark\nหมายเหตุ'];
    const data = rows.map(o => {
      const m = o.meta || {};
      return [o.customer_tel||'', o.customer_name||'', m.addr||o.customer_addr||'', m.subdistrict||'', m.district||'', m.zip||'', '', o.sp_pages?.name||'', '', o.total||0, o.total||0, `${o.sp_pages?.name||''} ${o.package_name||''} ฿${(o.total||0).toLocaleString()}`];
    });
    const bom = '\uFEFF';
    const csv = bom + [headers.map(h => `"${h}"`), ...data.map(r => r.map(c => typeof c === 'string' ? `"${c.replace(/"/g,'""')}"` : c))].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `ProShip-Flash-${today()}.csv`; a.click();
    showToast(`📥 Export ${rows.length} รายการ`);
  };

  const toggleAll = () => {
    if (selected.size === filteredOrders.length) setSelected(new Set());
    else setSelected(new Set(filteredOrders.map(o => o.id)));
  };

  // ── Login ──
  if (!authed) return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Noto Sans Thai', sans-serif" }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 32px', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,.08)', border: '1px solid #eee', width: 340 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏪</div>
        <h2 style={{ color: blue, marginBottom: 20, fontSize: 20 }}>SalePage Admin</h2>
        <input type="password" placeholder="รหัสผ่าน" value={pass} onChange={e => setPass(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') doLogin(); }}
          style={{ ...inp, width: '100%', marginBottom: 12, textAlign: 'center' }} />
        <button onClick={() => doLogin()}
          style={{ ...btnS(blue), width: '100%', padding: '12px 0', fontSize: 15 }}>เข้าสู่ระบบ</button>
        {toast && <div style={{ marginTop: 12, color: red, fontSize: 13 }}>{toast}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'Noto Sans Thai', sans-serif" }}>
      {toast && <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#333', color: '#fff', padding: '10px 28px', borderRadius: 30, zIndex: 999, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,.2)' }}>{toast}</div>}

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e0e0e0', padding: '12px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1400, margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: blue }}>🏪 SalePage Admin</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#999' }}>{orders.length} ออเดอร์ · ฿{totalRev.toLocaleString()}</span>
            <button onClick={doLogout} style={{ ...btnS('#f5f5f5', '#999'), fontSize: 12, border: '1px solid #ddd' }}>ออกจากระบบ</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 20 }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { l: 'เซลเพจ', v: pages.length, c: '#1abc9c', icon: '📄' },
            { l: 'ยอดขายรวม', v: `฿${totalRev.toLocaleString()}`, c: green, icon: '💰' },
            { l: 'ออเดอร์ทั้งหมด', v: orders.length, c: blue, icon: '📦' },
            { l: 'รอจัดการ', v: pendingCount, c: '#f39c12', icon: '⏳' },
            { l: 'Export แล้ว', v: orders.filter(o => o.status === 'exported').length, c: '#8e44ad', icon: '✅' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 14px', border: '1px solid #eee', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#999', fontWeight: 600, marginBottom: 4 }}>{s.icon} {s.l}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.c }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 10, overflow: 'hidden', border: '1px solid #ddd', width: 'fit-content' }}>
          {[['pages', '📄 เซลเพจ'], ['orders', '📦 ออเดอร์']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ padding: '12px 32px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                background: tab === id ? blue : '#fff', color: tab === id ? '#fff' : '#666' }}>{label}</button>
          ))}
        </div>

        {/* ═══ PAGES TAB ═══ */}
        {tab === 'pages' && (<div>
          <button onClick={() => setShowNew(!showNew)}
            style={{ padding: '12px 28px', borderRadius: 10, border: 'none', background: blue, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16, boxShadow: '0 2px 8px rgba(46,134,222,.3)' }}>
            ➕ สร้างเซลเพจใหม่
          </button>
          {showNew && (
            <div style={{ background: '#fff', borderRadius: 14, padding: 20, marginBottom: 14, border: '1px solid #ddd', maxWidth: 500 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>สร้างเซลเพจใหม่</div>
              <div style={{ marginBottom: 8 }}><div style={{ fontSize: 12, color: '#999', marginBottom: 3 }}>ชื่อสินค้า</div>
                <input value={newForm.name} onChange={e => setNewForm({ ...newForm, name: e.target.value })} placeholder="เช่น ครีมโสม" style={{ ...inp, width: '100%' }} /></div>
              <div style={{ marginBottom: 12 }}><div style={{ fontSize: 12, color: '#999', marginBottom: 3 }}>URL slug</div>
                <input value={newForm.slug} onChange={e => setNewForm({ ...newForm, slug: e.target.value })} placeholder="เช่น ginseng-cream" style={{ ...inp, width: '100%' }} /></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowNew(false)} style={{ ...btnS('#fff', '#999'), border: '1px solid #ddd' }}>ยกเลิก</button>
                <button onClick={handleCreate} style={btnS(green)}>✅ สร้าง</button>
              </div>
            </div>
          )}
          {loading && <div style={{ padding: 40, color: '#ccc' }}>กำลังโหลด...</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {pages.map(pg => {
              const pgOrders = orders.filter(o => o.page_id === pg.id);
              const pgRev = pgOrders.filter(o => o.status !== 'cancel').reduce((s, o) => s + (o.total || 0), 0);
              const pageUrl = `${window.location.origin}${import.meta.env.BASE_URL || '/'}#/${pg.slug}`;
              return (
                <div key={pg.id} style={{ background: '#fff', borderRadius: 14, padding: 18, border: '1px solid #eee' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#333', marginBottom: 4 }}>{pg.name}</div>
                      <div style={{ fontSize: 12, color: '#bbb', marginBottom: 8 }}>🔗 /{pg.slug}</div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                        <span style={{ color: blue }}>📦 {pgOrders.length}</span>
                        <span style={{ color: green }}>💰 ฿{pgRev.toLocaleString()}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <a href={pageUrl} target="_blank" style={{ ...btnS('#fff3e0', '#e65100'), textDecoration: 'none', fontSize: 12 }}>👁</a>
                      <button onClick={() => nav(`/admin/${pg.id}`)} style={{ ...btnS(blue), fontSize: 12 }}>✏️</button>
                      <button onClick={() => handleDelete(pg.id, pg.name)} style={{ ...btnS('#ffebee', red), fontSize: 12 }}>🗑</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>)}

        {/* ═══ ORDERS TAB ═══ */}
        {tab === 'orders' && (<div>
          {/* Filters bar */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #eee' }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหา ชื่อ/เบอร์/ที่อยู่" style={{ ...inp, width: 220 }} />
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#999' }}>จาก</span>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inp }} />
                <span style={{ fontSize: 12, color: '#999' }}>ถึง</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inp }} />
              </div>
              <select value={pageFilter} onChange={e => setPageFilter(e.target.value)} style={{ ...inp }}>
                <option value="all">ทุกเซลเพจ</option>
                {pages.map(pg => <option key={pg.id} value={pg.id}>{pg.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[['all', `ทั้งหมด (${orders.length})`], ['pending', '⏳ รอจัดการ'], ['exported', '✅ Export แล้ว'], ['shipped', '🚚 ส่งแล้ว'], ['done', '✓ สำเร็จ'], ['cancel', '❌ ยกเลิก']].map(([v, l]) => (
                  <button key={v} onClick={() => setStatusFilter(v)}
                    style={{ background: statusFilter === v ? (statusC[v] || blue) : '#f5f5f5', color: statusFilter === v ? '#fff' : '#666', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {selected.size > 0 && <>
                  <button onClick={bulkSetExported} style={{ ...btnS('#8e44ad'), fontSize: 12 }}>✅ เปลี่ยนเป็น Export แล้ว ({selected.size})</button>
                  <button onClick={() => exportProShip(true)} style={{ ...btnS(green), fontSize: 12 }}>📥 Export ที่เลือก ({selected.size})</button>
                </>}
                <button onClick={() => exportProShip(false)} style={{ ...btnS('#333'), fontSize: 12 }}>📥 Export ทั้งหมด ({filteredOrders.length})</button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 10 }}>แสดง {filteredOrders.length} รายการ · ยอดรวม ฿{filteredRev.toLocaleString()}</div>
          </div>

          {/* Table */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e0e0e0' }}>
                  <th style={{ padding: '12px 10px', textAlign: 'center', width: 40 }}>
                    <input type="checkbox" checked={selected.size > 0 && selected.size === filteredOrders.length} onChange={toggleAll} style={{ accentColor: blue }} />
                  </th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 700, color: '#555' }}>#</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 700, color: '#555' }}>วันที่</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 700, color: '#555' }}>ชื่อ</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 700, color: '#555' }}>เบอร์โทร</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 700, color: '#555' }}>ที่อยู่</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 700, color: '#555' }}>สินค้า</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700, color: '#555' }}>ยอด</th>
                  <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, color: '#555' }}>สถานะ</th>
                  <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 700, color: '#555' }}>เซลเพจ</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o, idx) => {
                  const m = o.meta || {};
                  const isChecked = selected.has(o.id);
                  return (
                    <tr key={o.id} style={{ borderBottom: '1px solid #f0f0f0', background: isChecked ? '#f0f4ff' : (idx % 2 === 0 ? '#fff' : '#fafafa') }}>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <input type="checkbox" checked={isChecked} onChange={() => {
                          const s = new Set(selected);
                          isChecked ? s.delete(o.id) : s.add(o.id);
                          setSelected(s);
                        }} style={{ accentColor: blue }} />
                      </td>
                      <td style={{ padding: '10px', color: '#bbb', fontSize: 11 }}>{idx + 1}</td>
                      <td style={{ padding: '10px', fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>{new Date(o.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}<br /><span style={{ fontSize: 10, color: '#bbb' }}>{new Date(o.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span></td>
                      <td style={{ padding: '10px', fontWeight: 600, color: '#333' }}>{o.customer_name}</td>
                      <td style={{ padding: '10px', color: '#555' }}>{o.customer_tel}</td>
                      <td style={{ padding: '10px', fontSize: 12, color: '#888', maxWidth: 200 }}>
                        {m.addr || o.customer_addr || ''}
                        {(m.subdistrict || m.district || m.zip) && <><br /><span style={{ color: '#aaa' }}>{[m.subdistrict, m.district, m.province, m.zip].filter(Boolean).join(' · ')}</span></>}
                      </td>
                      <td style={{ padding: '10px', fontSize: 12, color: '#555' }}>{o.package_name}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: green }}>฿{(o.total || 0).toLocaleString()}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <select value={o.status} onChange={e => handleStatusChange(o.id, e.target.value)}
                          style={{ background: (statusC[o.status] || '#999') + '18', color: statusC[o.status] || '#999', border: `1.5px solid ${statusC[o.status] || '#999'}40`, borderRadius: 8, padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}>
                          {Object.entries(statusL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '10px', fontSize: 11, color: blue }}>{o.sp_pages?.name || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredOrders.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#ccc' }}>ไม่พบออเดอร์</div>}
          </div>
        </div>)}
      </div>
    </div>
  );
}
