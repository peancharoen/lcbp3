import { AdminSidebar } from '@/components/admin/sidebar';

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
    <div className="flex h-screen w-full bg-background">
      <AdminSidebar />
      <div className="flex-1 overflow-auto bg-muted/10 p-4">{children}</div>
    </div>
  );
}
