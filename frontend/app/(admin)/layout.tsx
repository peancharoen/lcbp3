import { AdminSidebar } from "@/components/admin/sidebar";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";


export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // Check if user has admin role
  // This depends on your Session structure. Assuming user.roles exists (mapped in callback).
  // If not, you might need to check DB or use Can component logic but server-side.
  const isAdmin = session?.user?.roles?.some((r: any) => r.role_name === 'ADMIN');

  if (!session || !isAdmin) {
    // If not admin, redirect to dashboard or login
     redirect("/");
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
