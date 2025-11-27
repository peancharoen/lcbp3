// File: app/(auth)/layout.tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
      {/* Container หลักจัดกึ่งกลาง */}
      {children}
    </div>
  );
}