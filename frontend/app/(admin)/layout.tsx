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
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Mobile Header for Admin Panel */}
        <div className="h-16 border-b flex items-center px-4 md:hidden shrink-0 bg-white">
          <AdminMobileSidebar />
          <h2 className="text-lg font-semibold ml-4">LCBP3-DMS Admin</h2>
        </div>
        {/* Main Content */}
        <div className="flex-1 overflow-auto bg-muted/10 p-4">{children}</div>
      </div>
    </div>
  );
}
