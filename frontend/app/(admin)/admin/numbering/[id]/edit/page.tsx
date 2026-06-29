'use client';

import { redirect } from 'next/navigation';

export default function NumberingEditPage() {
  // Redirect to the correct numbering edit location
  redirect('/admin/doc-control/numbering/[id]/edit');
}
