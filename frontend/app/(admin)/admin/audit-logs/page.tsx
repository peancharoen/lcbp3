'use client';

import { redirect } from 'next/navigation';

export default function AuditLogsPage() {
  // Redirect to the correct audit-logs location
  redirect('/admin/monitoring/audit-logs');
}
