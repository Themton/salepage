# SalePage Manager 🏪

ระบบสร้างและจัดการเซลเพจไม่จำกัด พร้อมระบบหลังบ้าน + Supabase + Meta Pixel

## ✨ Features

- 📄 สร้างเซลเพจไม่จำกัด — แต่ละเพจมี URL เป็นของตัวเอง
- ⚙ แก้ไขทุกส่วน — ชื่อ, รูป, ราคา, แพ็คเกจ, รีวิว, FAQ, Pain Points
- 📦 จัดการออเดอร์ — ดู, เปลี่ยนสถานะ
- 👥 Import ลูกค้า CSV
- 📈 Meta Pixel Events — เก็บ PageView + Purchase ลง Supabase
- ⚡ Flash Sale นับถอยหลัง
- 🗄 Supabase Database

## 🚀 Setup

### 1. สร้าง Supabase Project
1. ไปที่ supabase.com → สร้าง project ใหม่
2. ไปที่ SQL Editor → วาง SQL จากไฟล์ supabase-schema.sql → Run
3. ไปที่ Settings > API → คัดลอก Project URL + anon public key

### 2. ตั้งค่า Environment
```
cp .env.example .env
# แก้ไข VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY
```

### 3. รัน Local
```
npm install
npm run dev
```

### 4. Deploy
- Vercel / Netlify: เชื่อม GitHub repo → ตั้ง env variables → auto deploy

## 📁 URLs

| URL | หน้า |
|-----|------|
| /admin | Admin Dashboard |
| /admin/:pageId | แก้ไขเซลเพจ |
| /:slug | หน้าเซลเพจ (ลูกค้าเห็น) |

## 🔐 Admin Password: admin1234
