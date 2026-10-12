import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';

// Force dynamic rendering for all pages under (dashboard) route group.
// QNAP overlayfs cannot handle the .segments/!<base64> directories
// that Next.js 16 creates during static page generation.
export const dynamic = 'force-dynamic';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-muted/10 p-6">{children}</main>
      </div>
    </div>
  );
}
