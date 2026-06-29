// File: app/(auth)/layout.tsx

// Force dynamic rendering for all pages under (auth) route group.
// QNAP overlayfs cannot handle the .segments/!<base64> directories
// that Next.js 16 creates during static page generation.
export const dynamic = 'force-dynamic';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
      {/* Container หลักจัดกึ่งกลาง */}
      {children}
    </div>
  );
}
