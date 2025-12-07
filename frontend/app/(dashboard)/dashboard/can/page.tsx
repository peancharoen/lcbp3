// File: app/(dashboard)/dashboard/can/page.tsx
'use client';

import { useAuthStore } from '@/lib/stores/auth-store';
import { Can } from '@/components/common/can';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function CanTestPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">RBAC / Permission Test Page</h1>

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Current User Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <span className="font-semibold">Username:</span>
            <span>{user?.username || 'Not logged in'}</span>
          </div>
          <div className="flex gap-2">
            <span className="font-semibold">Role:</span>
            <Badge variant="outline">{user?.role || 'None'}</Badge>
          </div>
          <div className="flex gap-2">
            <span className="font-semibold">Permissions:</span>
            <span>{user?.permissions?.join(', ') || 'No explicit permissions'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Permission Tests */}
      <Card>
        <CardHeader>
          <CardTitle>Component Visibility Tests (using &lt;Can /&gt;)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          <div className="p-4 border rounded bg-gray-50 flex flex-col gap-2">
            <p className="text-sm font-medium">1. Admin Role Check</p>
            <Can role="Admin" fallback={<span className="text-red-500 text-sm">❌ You are NOT an Admin (Hidden)</span>}>
              <Button variant="default" className="w-fit">✅ Visible to Admin Only</Button>
            </Can>
          </div>

          <div className="p-4 border rounded bg-gray-50 flex flex-col gap-2">
            <p className="text-sm font-medium">2. &apos;document:create&apos; Permission</p>
            <Can permission="document:create" fallback={<span className="text-red-500 text-sm">❌ Missing &apos;document:create&apos; (Hidden)</span>}>
              <Button variant="secondary" className="w-fit">✅ Visible with &apos;document:create&apos;</Button>
            </Can>
          </div>

          <div className="p-4 border rounded bg-gray-50 flex flex-col gap-2">
            <p className="text-sm font-medium">3. &apos;document:delete&apos; Permission</p>
            <Can permission="document:delete" fallback={<span className="text-red-500 text-sm">❌ Missing &apos;document:delete&apos; (Hidden)</span>}>
              <Button variant="destructive" className="w-fit">✅ Visible with &apos;document:delete&apos;</Button>
            </Can>
          </div>

        </CardContent>
      </Card>

      {/* Toast Test */}
      <Card>
        <CardHeader>
          <CardTitle>Toast Notification Test</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button
            onClick={() => toast.success("Operation Successful", { description: "This is a success toast message." })}
          >
            Trigger Success Toast
          </Button>
          <Button
            variant="destructive"
            onClick={() => toast.error("Operation Failed", { description: "This is an error toast message." })}
          >
            Trigger Error Toast
          </Button>
        </CardContent>
      </Card>

      <div className="p-4 bg-blue-50 text-blue-800 rounded">
        <strong>Tip:</strong> You can mock different roles by modifying the user state in local storage or using the `setAuth` method in console.
      </div>
    </div>
  );
}
