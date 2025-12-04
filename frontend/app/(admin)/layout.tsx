import { AdminSidebar } from "@/components/admin/sidebar";
import { redirect } from "next/navigation";
// import { getServerSession } from "next-auth"; // Commented out for now as we are mocking auth

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Mock Admin Check
  // const session = await getServerSession();
  // if (!session?.user?.roles?.some((r) => r.role_name === 'ADMIN')) {
  //   redirect('/');
  // }

  // For development, we assume user is admin
  const isAdmin = true;
  if (!isAdmin) {
    redirect("/");
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]"> {/* Subtract header height */}
      <AdminSidebar />
      <div className="flex-1 overflow-auto bg-muted/10">
        {children}
      </div>
    </div>
  );
}
