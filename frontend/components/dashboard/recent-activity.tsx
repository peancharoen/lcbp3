// File: components/dashboard/recent-activity.tsx
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Type จำลองตามโครงสร้าง v_audit_log_details
type AuditLogItem = {
  audit_id: number;
  username: string;
  email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  avatar?: string;
};

// Mock Data
const recentActivities: AuditLogItem[] = [
  {
    audit_id: 1,
    username: "Editor01",
    email: "editor01@example.com",
    action: "rfa.create",
    entity_type: "RFA",
    entity_id: "LCBP3-RFA-STR-001",
    created_at: "2025-11-26T09:00:00Z",
  },
  {
    audit_id: 2,
    username: "Superadmin",
    email: "admin@example.com",
    action: "user.create",
    entity_type: "User",
    entity_id: "new_user_01",
    created_at: "2025-11-26T10:30:00Z",
  },
  {
    audit_id: 3,
    username: "Viewer01",
    email: "viewer01@example.com",
    action: "document.view",
    entity_type: "Correspondence",
    entity_id: "LCBP3-LET-GEN-005",
    created_at: "2025-11-26T11:15:00Z",
  },
  {
    audit_id: 4,
    username: "Editor01",
    email: "editor01@example.com",
    action: "shop_drawing.upload",
    entity_type: "Shop Drawing",
    entity_id: "SHP-STR-COL-01",
    created_at: "2025-11-26T13:45:00Z",
  },
];

export function RecentActivity() {
  return (
    <Card className="col-span-3 lg:col-span-1">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {recentActivities.map((item) => (
            <div key={item.audit_id} className="flex items-center">
              <Avatar className="h-9 w-9">
                <AvatarImage src={item.avatar} alt={item.username} />
                <AvatarFallback>{item.username[0] + item.username[1]}</AvatarFallback>
              </Avatar>
              <div className="ml-4 space-y-1">
                <p className="text-sm font-medium leading-none">
                  {item.username}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatActionMessage(item)}
                </p>
              </div>
              <div className="ml-auto text-xs text-muted-foreground">
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function formatActionMessage(item: AuditLogItem) {
  // Simple formatter for demo. In real app, use translation or mapping.
  switch (item.action) {
    case "rfa.create":
      return `Created RFA ${item.entity_id}`;
    case "user.create":
      return `Created new user ${item.entity_id}`;
    case "document.view":
      return `Viewed document ${item.entity_id}`;
    case "shop_drawing.upload":
      return `Uploaded drawing ${item.entity_id}`;
    default:
      return `Performed ${item.action}`;
  }
}