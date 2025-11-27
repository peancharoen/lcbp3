// File: app/(dashboard)/layout.tsx
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { DashboardShell } from "@/components/layout/dashboard-shell"; // Import Wrapper

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-muted/10">
      {/* Sidebar (Fixed Position) */}
      <Sidebar />

      {/* Main Content (Dynamic Margin) */}
      <DashboardShell>
        <Navbar />
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          {children}
        </main>
      </DashboardShell>
    </div>
  );
}