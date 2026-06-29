'use client';

import { redirect } from 'next/navigation';

export default function WorkflowNewPage() {
  // Redirect to the correct workflows new location
  redirect('/admin/doc-control/workflows/new');
}
