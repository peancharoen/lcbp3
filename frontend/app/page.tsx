// File: app/page.tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  // เมื่อเข้าหน้าแรก ให้ Redirect ไปที่ /dashboard ทันที
  // ซึ่งถ้ายังไม่ Login -> Middleware จะดีดไปหน้า /login ให้เอง
  redirect("/dashboard");
}