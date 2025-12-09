import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Tag, Settings, Layers } from "lucide-react";
import Link from "next/link";

const refMenu = [
  {
    title: "Disciplines",
    description: "Manage system-wide disciplines (e.g., ARCH, STR)",
    href: "/admin/reference/disciplines",
    icon: Layers,
  },
  {
    title: "RFA Types",
    description: "Manage RFA types and approve codes",
    href: "/admin/reference/rfa-types",
    icon: BookOpen,
  },
  {
    title: "Correspondence Types",
    description: "Manage generic correspondence types",
    href: "/admin/reference/correspondence-types",
    icon: Settings,
  },
  {
    title: "Tags",
    description: "Manage system tags for documents",
    href: "/admin/reference/tags",
    icon: Tag,
  },
];

export default function ReferenceDataPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Reference Data Management</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {refMenu.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {item.title}
                </CardTitle>
                <item.icon className="h-4 w-4 text-muted-foreground" />
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
  );
}
