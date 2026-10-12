import { AdminSidebar, AdminMobileSidebar } from '@/components/admin/sidebar';

import { auth } from '@/lib/auth';

import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Validate Admin or DC role
  const userRole = session?.user?.role;
  const isAdmin = userRole === 'ADMIN' || userRole === 'DC';

  if (!session || !isAdmin) {
    redirect('/dashboard'); // Redirect unauthorized users to dashboard
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AdminSidebar />
      <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
        {/* Mobile Header for Admin Panel */}
        <div className="flex h-16 shrink-0 items-center border-b bg-white px-4 md:hidden">
          <AdminMobileSidebar />
          <h2 className="ml-4 text-lg font-semibold">LCBP3-DMS Admin</h2>
        </div>
        {/* Main Content */}
        <div className="flex-1 overflow-auto bg-muted/10 p-4">{children}</div>
      </div>
    </div>
  );
}
