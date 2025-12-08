import { AdminSidebar } from "@/components/admin/sidebar";

import { auth } from "@/lib/auth";


export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Temporary bypass for UI testing
  const isAdmin = true; // session?.user?.role === 'ADMIN';

  if (!session || !isAdmin) {
    // redirect("/");
  }

  return (
    <div className="flex h-screen w-full bg-background">
      <AdminSidebar />
      <div className="flex-1 overflow-auto bg-muted/10 p-4">
        {children}
      </div>
    </div>
  );
}
