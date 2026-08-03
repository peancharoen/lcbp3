# MCP Fetch Tools

MCP Fetch server ให้เครื่องมือสำหรับดึงเนื้อหาเว็บไซต์ในรูปแบบต่างๆ ใช้สำหรับ:

- ค้นคว้าเอกสาร, ADRs, หรือ reference จากเว็บนอกระบบ
- ดึง API documentation หรือ spec จาก URL ภายนอก
- อ่าน JSON response จาก public API
- สกัดเนื้อหาสำคัญจากบทความ/blog (Readability)

## Available Tools

| Tool                   | หน้าที่                                                | ตัวอย่างการใช้งาน                          |
| ---------------------- | ------------------------------------------------------ | ------------------------------------------ |
| `fetch_html`           | ดึงเว็บและคืน HTML ดิบ (unmodified)                    | ดู HTML source ดิบ                         |
| `fetch_markdown`       | ดึงเว็บและแปลงเป็น Markdown                            | อ่าน doc/spec ในรูปแบบ Markdown           |
| `fetch_txt`            | ดึงเว็บและแปลงเป็น plain text (ไม่มี HTML)            | สกัด text จากหน้าเว็บ                      |
| `fetch_json`           | ดึง JSON จาก URL                                      | อ่าน JSON API response                     |
| `fetch_readable`       | ดึงเว็บและสกัดเนื้อหาหลัก (Mozilla Readability) → Markdown | อ่านบทความ/blog (ตัด nav, ads, boilerplate) |
| `fetch_youtube_transcript` | ดึง transcript จาก YouTube video (มี `lang` option) | อ่าน subtitle ของวิดีโอ                    |

### Parameters ทั่วไป

| Parameter     | ค่าเริ่มต้น | หน้าที่                              |
| ------------- | ---------- | ------------------------------------ |
| `url`         | (required) | URL ที่จะดึง                         |
| `headers`     | -          | Optional headers สำหรับ request      |
| `max_length`  | 5000       | จำนวนตัวอักษรสูงสุดที่จะคืน         |
| `start_index` | 0          | ตำแหน่งเริ่มต้น (สำหรับ pagination)  |
| `proxy`       | -          | Optional proxy URL (เช่น `http://proxy:8080`) |

## การใช้งานร่วมกับ Development Flow

**เมื่อค้นคว้า documentation:**

1. ใช้ `fetch_readable` สำหรับบทความ/blog — ตัด boilerplate ออก
2. ใช้ `fetch_markdown` สำหรับ doc site ที่เป็น Markdown
3. ใช้ `fetch_json` สำหรับ API documentation ที่เป็น JSON (เช่น OpenAPI spec)

**เมื่อดึงเนื้อหายาว:**

1. เริ่มด้วย `max_length` ปกติ (5000)
2. หากขาด ใช้ `start_index` เพื่อดึงส่วนถัดไป (pagination ด้วยตนเอง)
3. ทำซ้ำจนกว่าเนื้อหาจะหมด

**เมื่อดึง JSON API:**

1. ใช้ `fetch_json` (ไม่ใช่ `fetch_txt` แล้ว parse เอง)
2. ตรวจสอบ `headers` หาก API ต้องการ auth หรือ content-type เฉพาะ

## ข้อควรระวัง

- **⚠️ ห้ามดึง URL ที่ผู้ใช้ไม่ได้ให้มาโดยไม่จำเป็น** — ใช้เฉพาะเมื่อจำเป็นสำหรับงาน programming
- **⚠️ ระวัง `max_length` default = 5000** — เนื้อหายาวจะถูกตัด ต้องใช้ `start_index` ดึงต่อ
- **✅ ใช้ `fetch_readable` สำหรับ article** — ลด noise จาก nav/ads/footer
- **✅ ใช้ `fetch_json` สำหรับ JSON** — ไม่ใช้ `fetch_txt` แล้ว parse เอง
- **❌ ห้ามใช้ fetch สำหรับ scraping ข้อมูลส่วนบุคคล/credential** — ใช้สำหรับ programming reference เท่านั้น
- **⚠️ ระวัง proxy ใน production network** — อาจมี firewall/proxy policy เฉพาะ

## Related Documents

- ใช้คู่กับ `web_search` และ `webfetch` tools ในตัวสำหรับงานค้นคว้าทั่วไป
