# BK16 Live

เว็บไซต์ Live Streaming Hub พร้อมตารางการแข่งขันฟุตบอลที่แสดงเวลาไทย โดยแยกส่วนหน้าเว็บและ API proxy ออกจากกันอย่างปลอดภัย

## Architecture

- **GitHub Pages** — ให้บริการหน้าเว็บไซต์แบบ static
- **Cloudflare Worker** — ซ่อน `football-data.org` API Token และทำหน้าที่ proxy
- **football-data.org API v4** — ข้อมูลการแข่งขัน สถานะ และผลสกอร์

```text
Browser → GitHub Pages → Cloudflare Worker → football-data.org
```

## โครงสร้าง

```text
index.html
assets/
  css/app.css
  js/config.js
  js/channels.js
  js/app.js
worker/
  src/worker.js
  package.json
  wrangler.toml
.github/workflows/
  pages.yml
  worker.yml
```

## 1. ตั้งค่า GitHub Secrets สำหรับ Worker

ไปที่ **Settings → Secrets and variables → Actions → New repository secret** แล้วเพิ่ม:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `FOOTBALL_DATA_TOKEN`

> อย่าใส่ Token ลงใน `index.html`, `config.js` หรือไฟล์อื่นใน repository

## 2. Deploy Cloudflare Worker

เปิดแท็บ **Actions → Deploy Cloudflare Worker → Run workflow**

เมื่อสำเร็จ Cloudflare จะแสดง URL ลักษณะนี้:

```text
https://bk16-football-api.<workers-subdomain>.workers.dev
```

ทดสอบ:

```text
https://bk16-football-api.<workers-subdomain>.workers.dev/health
```

## 3. ตั้งค่า URL สำหรับหน้าเว็บไซต์

ไปที่ **Settings → Secrets and variables → Actions → Variables → New repository variable**

สร้างตัวแปร:

```text
Name: FOOTBALL_API_URL
Value: https://bk16-football-api.<workers-subdomain>.workers.dev
```

จากนั้นรัน workflow **Deploy GitHub Pages** ใหม่

## 4. เปิด GitHub Pages

ไปที่ **Settings → Pages → Build and deployment → Source** แล้วเลือก **GitHub Actions**

เว็บไซต์จะอยู่ที่:

```text
https://rachane16.github.io/BK16_Live/
```

## แก้ไขรายการช่อง

แก้เฉพาะไฟล์:

```text
assets/js/channels.js
```

แต่ละช่องมีโครงสร้าง:

```js
{
  id: "channel-id",
  name: "Channel name",
  logo: "https://example.com/logo.png",
  url: "https://example.com/playlist.m3u8"
}
```

## ความปลอดภัย

Token ที่เคยเผยแพร่ใน public repository หรือข้อความสาธารณะควรถูกยกเลิกและสร้างใหม่ก่อนใช้งานจริง
