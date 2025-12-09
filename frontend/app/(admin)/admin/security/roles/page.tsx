"use client";

import { RbacMatrix } from "@/components/admin/security/rbac-matrix";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RolesPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Roles & Permissions</h1>
          <p className="text-muted-foreground">
            Manage system roles and their assigned permissions
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>RBAC Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <RbacMatrix />
        </CardContent>
      </Card>
    </div>
  );
}
