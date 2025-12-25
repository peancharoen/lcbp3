"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileStack,
  FolderTree,
  Layers,
  BookOpen,
  FileBox
} from "lucide-react";
import Link from "next/link";

const contractDrawingMenu = [
  {
    title: "Volumes",
    description: "Manage contract drawing volumes (เล่ม)",
    href: "/admin/drawings/contract/volumes",
    icon: BookOpen,
  },
  {
    title: "Categories",
    description: "Manage main categories (หมวดหมู่หลัก)",
    href: "/admin/drawings/contract/categories",
    icon: FolderTree,
  },
  {
    title: "Sub-categories",
    description: "Manage sub-categories (หมวดหมู่ย่อย)",
    href: "/admin/drawings/contract/sub-categories",
    icon: Layers,
  },
];

const shopDrawingMenu = [
  {
    title: "Main Categories",
    description: "Manage main categories (หมวดหมู่หลัก)",
    href: "/admin/drawings/shop/main-categories",
    icon: FolderTree,
  },
  {
    title: "Sub-categories",
    description: "Manage sub-categories (หมวดหมู่ย่อย)",
    href: "/admin/drawings/shop/sub-categories",
    icon: Layers,
  },
];

export default function DrawingsAdminPage() {
  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Drawing Master Data</h1>
        <p className="text-muted-foreground mt-1">
          Manage categories and volumes for Contract and Shop Drawings
        </p>
      </div>

      {/* Contract Drawings Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileStack className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Contract Drawings</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contractDrawingMenu.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-blue-200 hover:border-blue-400">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {item.title}
                  </CardTitle>
                  <item.icon className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Shop Drawings Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileBox className="h-5 w-5 text-green-600" />
          <h2 className="text-lg font-semibold">Shop Drawings / As Built</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shopDrawingMenu.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-green-200 hover:border-green-400">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {item.title}
                  </CardTitle>
                  <item.icon className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
