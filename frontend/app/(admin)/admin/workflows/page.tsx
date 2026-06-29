'use client';

import { redirect } from 'next/navigation';

export default function WorkflowsPage() {
  // Redirect to the correct workflows location
  redirect('/admin/doc-control/workflows');
}
