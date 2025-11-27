// File: config/menu.ts
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  PenTool,
  FileOutput,
  RefreshCw,
  Settings,
  Users,
  Briefcase,
  Search
} from "lucide-react";

export const sidebarMenuItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Projects (โครงการ)", // เพิ่มเมนูนี้
    href: "/projects",
    icon: Briefcase,
  },
  {
    title: "Correspondences",
    href: "/correspondences",
    icon: FileText,
  },
  {
    title: "RFAs (ขออนุมัติ)",
    href: "/rfas",
    icon: CheckSquare,
  },
  {
    title: "Drawings (แบบแปลน)",
    href: "/drawings",
    icon: PenTool,
  },
  {
    title: "Transmittals (นำส่ง)",
    href: "/transmittals",
    icon: FileOutput,
  },
  {
    title: "Circulations (ใบเวียน)",
    href: "/circulations",
    icon: RefreshCw,
  },
  {
    title: "ค้นหาเอกสาร",
    href: "/search",
    icon: Search,
  },
];

export const adminMenuItems = [
  {
    title: "จัดการผู้ใช้งาน",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "ตั้งค่าระบบ",
    href: "/admin/settings",
    icon: Settings,
  },
];