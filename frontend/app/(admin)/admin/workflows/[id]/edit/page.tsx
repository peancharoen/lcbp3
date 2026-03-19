'use client';

import { redirect } from 'next/navigation';

export default function WorkflowEditPage() {
  // Redirect to the correct workflows edit location
  redirect('/admin/doc-control/workflows/[id]/edit');
}
