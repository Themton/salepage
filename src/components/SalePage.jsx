import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getPageBySlug, createOrder, trackEvent } from '../lib/supabase';

const accent = '#2e86de', red = '#c0392b', bg = '#faf9f6', gold = '#c9953c';
const pad = n => String(n).padStart(2, '0');
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

// ── Facebook Pixel ──
function initPixel(pixelId) {
  if (!pixelId || typeof window === 'undefined') return;
  if (window.fbq) { window.fbq('init', pixelId); window.fbq('track', 'PageView'); return; }
  const f = window.fbq = function() { f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); };
  f.push = f; f.loaded = true; f.version = '2.0'; f.queue = [];
  const s = document.createElement('script'); s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);
  const n = document.createElement('noscript');
  n.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/>`;
  document.body.appendChild(n);
  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
}

function fbTrack(event, data = {}) {
  if (window.fbq) window.fbq('track', event, data);
}

export default function SalePage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pkg, setPkg] = useState(1);
  const [form, setForm] = useState({ name: '', tel: '', addr: '', subdistrict: '', district: '', province: '', zip: '', fbline: '', remark: '' });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const [openFaq, setOpenFaq] = useState(null);
  const formRef = useRef();

  useEffect(() => {
    (async () => {
      const p = await getPageBySlug(slug);
      if (p) {
        setPage(p);
        trackEvent(p.id, 'PageView', { slug });
        initPixel(p.pixel_id);
      }
      setLoading(false);
    })();
  }, [slug]);

  const p = page ? { ...page.settings, name: page.name, pixelId: page.pixel_id } : null;

  // Countdown
  useEffect(() => {
    if (!p?.flashSale?.enabled || !p?.flashSale?.endTime) return;
    const tick = () => {
      const d = new Date(p.flashSale.endTime) - new Date();
      if (d <= 0) { setCountdown(null); return; }
      setCountdown({ h: Math.floor(d / 36e5), m: Math.floor((d % 36e5) / 6e4), s: Math.floor((d % 6e4) / 1e3) });
    };
    tick(); const iv = setInterval(tick, 1e3); return () => clearInterval(iv);
  }, [p?.flashSale]);

  // Slider
  const imgs = p?.images || [];
  useEffect(() => { if (imgs.length < 2) return; const iv = setInterval(() => setSlideIdx(i => (i + 1) % imgs.length), 4e3); return () => clearInterval(iv); }, [imgs.length]);

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth' });

  const submit = async () => {
    if (!form.name || !form.tel || !form.addr) return alert('กรุณากรอกข้อมูลให้ครบ');
    const telClean = form.tel.replace(/\D/g, '');
    if (telClean.length !== 10) return alert('เบอร์โทรศัพท์ต้องครบ 10 หลัก');
    setSending(true);
    const selPkg = p.packages?.[pkg] || p.packages?.[0] || { name: 'สินค้า', price: 0 };
    try {
      const orderData = {
        page_id: page.id,
        customer_name: form.name,
        customer_tel: form.tel,
        customer_addr: `${form.addr} ${form.subdistrict} ${form.district} ${form.province} ${form.zip}`.trim(),
        package_name: selPkg.name,
        total: selPkg.price,
        status: 'pending',
        meta: { pkg, subdistrict: form.subdistrict, district: form.district, province: form.province, zip: form.zip, addr: form.addr, fbline: form.fbline, remark: form.remark },
      };
      const order = await createOrder(orderData);
      await trackEvent(page.id, 'Purchase', { value: selPkg.price, package: selPkg.name });
      fbTrack('Purchase', { value: selPkg.price, currency: 'THB', content_name: p.name });
      setDone(true);
    } catch (e) { alert('เกิดข้อผิดพลาด กรุณาลองใหม่'); }
    setSending(false);
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, fontFamily: "'Noto Sans Thai', sans-serif" }}>กำลังโหลด...</div>;
  if (!page) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, fontFamily: "'Noto Sans Thai', sans-serif", flexDirection: 'column', gap: 12 }}><div style={{ fontSize: 48 }}>🔍</div><div style={{ fontSize: 18, fontWeight: 700 }}>ไม่พบหน้าเซลเพจ</div><div style={{ color: '#999', fontSize: 14 }}>/{slug}</div></div>;

  const selPkg = p.packages?.[pkg];

  const ss = p.successShow || {};

  if (done) return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Noto Sans Thai', sans-serif", padding: 20 }}>
      <div className="fade-in" style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ width: 70, height: 70, borderRadius: '50%', background: '#e3f2fd', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 32 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>{p.successTitle || 'สั่งซื้อสำเร็จ!'}</h2>
        <p style={{ color: '#777', fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>{(p.successMsg || 'ขอบคุณค่ะ ทีมงานจะโทรยืนยัน\nภายใน 30 นาที').split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}</p>
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, border: '1px solid #eee', textAlign: 'left' }}>
          {ss.showPkg !== false && <div style={{ fontSize: 14, fontWeight: 600 }}>{selPkg?.name} — ฿{selPkg?.price?.toLocaleString()}</div>}
          {(ss.showName !== false || ss.showPhone !== false) && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{ss.showName !== false && `👤 ${form.name}`}{ss.showName !== false && ss.showPhone !== false && ' · '}{ss.showPhone !== false && `📞 ${form.tel}`}</div>}
          {ss.showAddr !== false && <div style={{ fontSize: 12, color: '#888' }}>📍 {form.addr} {form.subdistrict} {form.district} {form.zip}</div>}
          {ss.showRemark !== false && form.remark && <div style={{ fontSize: 12, color: '#888' }}>📝 {form.remark}</div>}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: bg, color: '#222', fontFamily: "'Noto Sans Thai', sans-serif" }}>

      {/* COUNTDOWN */}
      {countdown && (
        <div style={{ background: `linear-gradient(135deg, ${red}, #e74c3c)`, color: '#fff', textAlign: 'center', padding: '10px 16px', fontSize: 13, fontWeight: 700, position: 'sticky', top: 0, zIndex: 90 }}>
          โปรโมชั่นจะหมดใน <span style={{ background: '#fff2', padding: '2px 8px', borderRadius: 6, fontSize: 16, fontFamily: 'monospace', marginLeft: 6 }}>{pad(countdown.h)}:{pad(countdown.m)}:{pad(countdown.s)}</span>
        </div>
      )}

      {/* HERO */}
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', color: '#fff', padding: '32px 18px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e67e22', marginBottom: 8 }}>🔥 โปรสุดคุ้ม วันนี้เท่านั้น!</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px', lineHeight: 1.4, color: '#222' }}>{p.name}</h1>
        <p style={{ fontSize: 14, margin: '0 0 20px', color: '#888' }}>{p.subtitle || p.tagline}</p>

        {imgs.length > 0 ? (
          <div style={{ position: 'relative', width: '80%', maxWidth: 300, margin: '0 auto', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,.3)' }}>
            <div style={{ display: 'flex', transition: 'transform .5s', transform: `translateX(-${slideIdx * 100}%)` }}>
              {imgs.map((src, i) => <img key={i} src={src} style={{ width: '100%', flexShrink: 0, aspectRatio: '1', objectFit: 'cover' }} />)}
            </div>
            {imgs.length > 1 && <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5 }}>
              {imgs.map((_, i) => <div key={i} onClick={() => setSlideIdx(i)} style={{ width: 7, height: 7, borderRadius: '50%', background: i === slideIdx ? accent : '#ccc', cursor: 'pointer' }} />)}
            </div>}
          </div>
        ) : (
          <div style={{ width: 160, height: 180, borderRadius: 16, background: '#f0f2f5', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #ddd', fontSize: 48 }}>🧴</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 20, fontSize: 12, color: '#999' }}>
          <span>📦 เก็บเงินปลายทาง</span><span>🚚 ส่งฟรีทั่วประเทศ</span>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto' }}>

        {/* PAIN POINTS */}
        {p.painPoints?.length > 0 && (
          <div style={{ padding: '28px 18px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, textAlign: 'center', marginBottom: 14 }}>คุณมีปัญหาเหล่านี้ไหม?</h2>
            {p.painPoints.map((pt, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #f0ece4' }}>
                <span style={{ fontSize: 18 }}>{['😟','😣','😩','😤','😰'][i % 5]}</span>
                <span style={{ fontSize: 14, color: '#444' }}>{pt}</span>
              </div>
            ))}
          </div>
        )}

        {/* SOLUTION */}
        <div style={{ background: '#f0f7ff', color: '#333', padding: '22px 18px', textAlign: 'center', borderRadius: 0 }}>
          <div style={{ fontSize: 14, color: '#e67e22', marginBottom: 4 }}>✨ หมดปัญหาด้วย</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{p.name}</div>
        </div>

        {/* BENEFITS */}
        {p.benefits?.length > 0 && (
          <div style={{ padding: '28px 18px' }}>
            {p.benefits.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#e3f2fd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: accent, fontWeight: 800, fontSize: 15 }}>✓</div>
                <div><div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{b.title}</div><div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>{b.desc}</div></div>
              </div>
            ))}
          </div>
        )}

        {/* INGREDIENTS */}
        {p.ingredients?.length > 0 && (
          <div style={{ background: '#f4f1eb', padding: '28px 18px' }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, textAlign: 'center', marginBottom: 14 }}>ส่วนผสมหลักระดับพรีเมียม</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {p.ingredients.map((ing, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '14px 12px', textAlign: 'center', border: '1px solid #ebe7df' }}>
                  <div style={{ fontSize: 26, marginBottom: 4 }}>{ing.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{ing.name}</div>
                  <div style={{ fontSize: 10, color: '#888' }}>{ing.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BEFORE/AFTER */}
        {p.beforeAfterImg && (
          <div style={{ padding: '28px 18px', textAlign: 'center' }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>ผลลัพธ์จริงจากลูกค้า</h2>
            <img src={p.beforeAfterImg} style={{ width: '100%', borderRadius: 14 }} />
          </div>
        )}

        {/* REVIEWS */}
        {p.reviews?.length > 0 && (
          <div style={{ background: '#f4f1eb', padding: '28px 18px' }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, textAlign: 'center', marginBottom: 14 }}>⭐ รีวิวจากลูกค้าจริง</h2>
            {p.reviews.map((r, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, border: '1px solid #ebe7df' }}>
                <div style={{ color: '#f5a623', fontSize: 13, letterSpacing: 2, marginBottom: 6 }}>{stars(r.rating)}</div>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: '#444', lineHeight: 1.7 }}>{r.text}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#e3f2fd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👩</div>
                  <div><div style={{ fontSize: 12, fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: 10, color: '#999' }}>{r.location}</div></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PACKAGES */}
        {p.packages?.length > 0 && (
          <div style={{ padding: '28px 18px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, textAlign: 'center', marginBottom: 14 }}>🎉 โปรโมชั่นพิเศษ!</h2>
            {p.packages.map((pk, i) => {
              const sel = pkg === i;
              const pct = pk.orig > 0 ? Math.round((1 - pk.price / pk.orig) * 100) : 0;
              return (
                <div key={i} onClick={() => setPkg(i)}
                  style={{ borderRadius: 14, padding: '16px 14px', marginBottom: 8, cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'all .2s',
                    border: sel ? `2.5px solid ${accent}` : '1.5px solid #e0dcd4',
                    background: sel ? '#f0faf4' : '#fff',
                    boxShadow: sel ? `0 4px 16px ${accent}22` : 'none' }}>
                  {pk.badge && <div style={{ position: 'absolute', top: 0, right: 0, background: i >= 2 ? '#9b59b6' : red, color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 12px', borderRadius: '0 12px 0 10px' }}>{pk.badge}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', border: sel ? `6px solid ${accent}` : '2px solid #ccc', boxSizing: 'border-box', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{pk.name}</div>
                      <div style={{ fontSize: 11, color: '#999' }}>{pk.desc}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {pk.orig > pk.price && <div style={{ fontSize: 12, color: '#bbb', textDecoration: 'line-through' }}>฿{pk.orig.toLocaleString()}</div>}
                      <div style={{ fontSize: 22, fontWeight: 800, color: sel ? accent : '#333' }}>฿{pk.price.toLocaleString()}</div>
                      {pct > 0 && <div style={{ fontSize: 10, color: red, fontWeight: 700 }}>ประหยัด {pct}%</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ORDER FORM */}
        <div ref={formRef} style={{ padding: '0 18px 24px' }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: '24px 20px', boxShadow: '0 4px 24px rgba(0,0,0,.07)', border: '1px solid #e8e4dc' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, textAlign: 'center', margin: '0 0 4px' }}>📋 กรอกข้อมูลสั่งซื้อ</h2>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#999', marginBottom: 16 }}>เก็บเงินปลายทาง ส่งฟรีทั่วประเทศ</p>

            {[['name', 'ชื่อ - นามสกุล *']].map(([k, ph]) => (
              <input key={k} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} placeholder={ph}
                style={{ width: '100%', boxSizing: 'border-box', background: '#faf9f6', border: '1.5px solid #e0dcd4', borderRadius: 10, padding: '13px 16px', fontSize: 15, outline: 'none', fontFamily: 'inherit', marginBottom: 10, color: '#222' }} />
            ))}

            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input value={form.tel} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); setForm({ ...form, tel: v }); }}
                placeholder="เบอร์โทรศัพท์ * (10 หลัก)" type="tel" maxLength={10}
                style={{ width: '100%', boxSizing: 'border-box', background: '#faf9f6', border: `1.5px solid ${form.tel && form.tel.length !== 10 ? '#e74c3c' : '#e0dcd4'}`, borderRadius: 10, padding: '13px 16px', fontSize: 15, outline: 'none', fontFamily: 'inherit', color: '#222' }} />
              <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: form.tel.length === 10 ? '#27ae60' : '#ccc' }}>{form.tel.length}/10</span>
            </div>

            <textarea value={form.addr} onChange={e => setForm({ ...form, addr: e.target.value })} placeholder="ที่อยู่ * (บ้านเลขที่ ซอย ถนน)" rows={2}
              style={{ width: '100%', boxSizing: 'border-box', background: '#faf9f6', border: '1.5px solid #e0dcd4', borderRadius: 10, padding: '13px 16px', fontSize: 15, outline: 'none', fontFamily: 'inherit', marginBottom: 10, color: '#222', resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input value={form.subdistrict} onChange={e => setForm({ ...form, subdistrict: e.target.value })} placeholder="ตำบล/แขวง"
                style={{ flex: 1, boxSizing: 'border-box', background: '#faf9f6', border: '1.5px solid #e0dcd4', borderRadius: 10, padding: '13px 16px', fontSize: 15, outline: 'none', fontFamily: 'inherit', color: '#222' }} />
              <input value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} placeholder="อำเภอ/เขต"
                style={{ flex: 1, boxSizing: 'border-box', background: '#faf9f6', border: '1.5px solid #e0dcd4', borderRadius: 10, padding: '13px 16px', fontSize: 15, outline: 'none', fontFamily: 'inherit', color: '#222' }} />
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input value={form.province} onChange={e => setForm({ ...form, province: e.target.value })} placeholder="จังหวัด"
                style={{ flex: 1, boxSizing: 'border-box', background: '#faf9f6', border: '1.5px solid #e0dcd4', borderRadius: 10, padding: '13px 16px', fontSize: 15, outline: 'none', fontFamily: 'inherit', color: '#222' }} />
              <input value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} placeholder="รหัสไปรษณีย์" type="tel"
                style={{ flex: 1, boxSizing: 'border-box', background: '#faf9f6', border: '1.5px solid #e0dcd4', borderRadius: 10, padding: '13px 16px', fontSize: 15, outline: 'none', fontFamily: 'inherit', color: '#222' }} />
              <input value={form.fbline} onChange={e => setForm({ ...form, fbline: e.target.value })} placeholder="Facebook/Line (ไม่บังคับ)"
                style={{ flex: 1, boxSizing: 'border-box', background: '#faf9f6', border: '1.5px solid #e0dcd4', borderRadius: 10, padding: '13px 16px', fontSize: 15, outline: 'none', fontFamily: 'inherit', color: '#222' }} />
            </div>

            <input value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} placeholder="หมายเหตุ (ไม่บังคับ)"
              style={{ width: '100%', boxSizing: 'border-box', background: '#faf9f6', border: '1.5px solid #e0dcd4', borderRadius: 10, padding: '13px 16px', fontSize: 15, outline: 'none', fontFamily: 'inherit', marginBottom: 14, color: '#222' }} />

            {/* ── สรุปยอดชำระ ── */}
            {selPkg && (
              <div style={{ background: '#f8f9fa', borderRadius: 12, padding: '14px 16px', marginBottom: 16, border: '1px solid #eee' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 10 }}>🧾 สรุปคำสั่งซื้อ</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
                  <span style={{ color: '#666' }}>{selPkg.name}</span>
                  <span style={{ color: '#333', fontWeight: 600 }}>฿{selPkg.price?.toLocaleString()}</span>
                </div>
                {selPkg.orig > selPkg.price && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                    <span style={{ color: '#999' }}>ส่วนลด</span>
                    <span style={{ color: red, fontWeight: 600 }}>-฿{(selPkg.orig - selPkg.price).toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: '#999' }}>ค่าจัดส่ง</span>
                  <span style={{ color: '#27ae60', fontWeight: 600 }}>ฟรี</span>
                </div>
                <div style={{ borderTop: '1.5px solid #e0e0e0', paddingTop: 10, marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>ยอดชำระทั้งหมด</span>
                  <span style={{ fontSize: 24, fontWeight: 800, color: accent }}>฿{selPkg.price?.toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 11, color: '#bbb', marginTop: 6, textAlign: 'right' }}>💰 ชำระเงินปลายทาง (COD)</div>
              </div>
            )}

            <button onClick={submit} disabled={sending}
              style={{ width: '100%', padding: '16px 0', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${accent}, #5fa8e8)`, color: '#fff', fontSize: 17, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 4px 16px ${accent}44`, animation: 'pulse 2s infinite' }}>
              {sending ? 'กำลังสั่งซื้อ...' : '✅ ยืนยันสั่งซื้อ (เก็บเงินปลายทาง)'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12, fontSize: 11, color: '#aaa' }}>
              <span>🔒 ปลอดภัย</span><span>📦 ส่งฟรี</span><span>💰 เก็บเงินปลายทาง</span>
            </div>
          </div>
        </div>

        {/* GUARANTEE */}
        {p.guarantee && (
          <div style={{ padding: '0 18px 24px' }}>
            <div style={{ background: '#f0f7ff', borderRadius: 14, padding: '20px 18px', textAlign: 'center', border: `1px solid ${accent}22` }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>🛡️</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>รับประกันคืนเงิน 30 วัน</div>
              <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>{p.guarantee}</div>
            </div>
          </div>
        )}

        {/* FAQ */}
        {p.faq?.length > 0 && (
          <div style={{ padding: '0 18px 24px' }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, textAlign: 'center', marginBottom: 12 }}>❓ คำถามที่พบบ่อย</h2>
            {p.faq.map((f, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, marginBottom: 6, border: '1px solid #e8e4dc', overflow: 'hidden' }}>
                <div onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, fontSize: 14 }}>
                  <span>{f.q}</span>
                  <span style={{ fontSize: 18, color: '#bbb', transition: 'transform .2s', transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>+</span>
                </div>
                {openFaq === i && <div style={{ padding: '0 16px 14px', fontSize: 13, color: '#666', lineHeight: 1.7 }}>{f.a}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ background: '#2a2a2a', color: '#888', textAlign: 'center', padding: '20px 18px', fontSize: 11, lineHeight: 1.8 }}>
        © 2026 {p.name}<br />สินค้ามี อย. ปลอดภัย 100%
      </div>

      {/* STICKY CTA */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', padding: '10px 18px', boxShadow: '0 -4px 20px rgba(0,0,0,.1)', zIndex: 80, textAlign: 'center' }}>
        <button onClick={scrollToForm}
          style={{ width: '100%', maxWidth: 500, padding: '13px 0', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${accent}, #5fa8e8)`, color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
          🛒 สั่งซื้อเลย — เริ่มต้น ฿{p.packages?.[0]?.price || 299} ส่งฟรี!
        </button>
      </div>
      <div style={{ height: 60 }} />
    </div>
  );
}
