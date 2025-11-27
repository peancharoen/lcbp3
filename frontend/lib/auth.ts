// File: lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import type { User } from "next-auth";

// Schema สำหรับ Validate ข้อมูลขาเข้าอีกครั้งเพื่อความปลอดภัย
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        try {
          // 1. Validate ข้อมูลที่ส่งมาจากฟอร์ม
          const { username, password } = await loginSchema.parseAsync(credentials);
          
          // อ่านค่าจาก ENV หรือใช้ Default (ต้องมั่นใจว่าชี้ไปที่ Port 3001 และมี /api)
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
          
          console.log(`Attempting login to: ${baseUrl}/auth/login`);

          // 2. เรียก API ไปยัง NestJS Backend
          const res = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });

          // ถ้า Backend ตอบกลับมาว่าไม่สำเร็จ (เช่น 401, 404, 500)
          if (!res.ok) {
            const errorMsg = await res.text();
            console.error("Login failed:", errorMsg);
            return null;
          }

          // 3. รับข้อมูล JSON จาก Backend
          // โครงสร้างที่ Backend ส่งมา: { statusCode: 200, message: "...", data: { access_token: "...", user: {...} } }
          const responseJson = await res.json();
          
          // เจาะเข้าไปเอาข้อมูลจริงใน .data
          const backendData = responseJson.data;

          // ตรวจสอบว่ามี Token หรือไม่
          if (!backendData || !backendData.access_token) {
            console.error("No access token received in response data");
            return null;
          }

          // 4. Return ข้อมูล User เพื่อส่งต่อไปยัง JWT Callback
          // ต้อง Map ชื่อ Field ให้ตรงกับที่ NextAuth คาดหวัง และเก็บ Access Token
          return {
            // Map user_id จาก DB ให้เป็น id (string) ตามที่ NextAuth ต้องการ
            id: backendData.user.user_id.toString(),
            // รวมชื่อจริงนามสกุล
            name: `${backendData.user.firstName} ${backendData.user.lastName}`,
            email: backendData.user.email,
            username: backendData.user.username,
            // Role (ถ้า Backend ยังไม่ส่ง role มา อาจต้องใส่ Default หรือปรับ Backend เพิ่มเติม)
            role: backendData.user.role || "User", 
            organizationId: backendData.user.primaryOrganizationId,
            // เก็บ Token ไว้ใช้งาน
            accessToken: backendData.access_token,
          } as User;

        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login", // กำหนดหน้า Login ของเราเอง
    error: "/login",  // กรณีเกิด Error ให้กลับมาหน้า Login
  },
  callbacks: {
    // 1. JWT Callback: ทำงานเมื่อสร้าง Token หรืออ่าน Token
    async jwt({ token, user }) {
      // ถ้ามี user เข้ามา (คือตอน Login ครั้งแรก) ให้บันทึกข้อมูลลง Token
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.accessToken = user.accessToken;
      }
      return token;
    },
    // 2. Session Callback: ทำงานเมื่อฝั่ง Client เรียก useSession()
    async session({ session, token }) {
      // ส่งข้อมูลจาก Token ไปให้ Client ใช้งาน
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.organizationId = token.organizationId as number;
        session.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 ชั่วโมง
  },
  secret: process.env.AUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
});