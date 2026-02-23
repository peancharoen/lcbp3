// File: next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Standalone Output: จำเป็นสำหรับการ Deploy บน Docker (QNAP)
  // Next.js จะคัดแยกเฉพาะไฟล์ที่จำเป็นต้องใช้จริงออกมาไว้ในโฟลเดอร์ .next/standalone
  output: "standalone",

  // 2. React Strict Mode: ช่วยดักจับ Bug ในช่วง Dev (เช่น Component render ซ้ำ)
  reactStrictMode: true,

  // 3. Image Configuration: อนุญาตโหลดรูปจาก Domain ภายนอก
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**", // อนุญาตทุก Domain สำหรับ Avatar (ในการใช้งานจริงควรระบุ Domain เฉพาะ เช่น googleusercontent.com)
      },
    ],
    // ลดขนาดไฟล์รูปภาพที่จะถูก optimize
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // Cache optimized images for 24h (reduces re-optimization on containers)
    minimumCacheTTL: 86400,
  },

  // 4. (Optional) Rewrites: กรณีต้องการ Proxy API ผ่าน Next.js เพื่อเลี่ยง CORS ใน Dev
  // แต่ในโปรเจกต์นี้เราใช้ Axios BaseURL ชี้ไปที่ Backend โดยตรงแล้ว จึงอาจไม่จำเป็นต้องเปิด
  /*
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`,
      },
    ]
  },
  */

  // 5. Security Headers (แนะนำ)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN' // ป้องกันการถูก Embedding ใน Iframe (Clickjacking)
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          }
        ],
      },
    ];
  },
};

export default nextConfig;
