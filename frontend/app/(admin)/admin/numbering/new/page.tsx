'use client';

import { redirect } from 'next/navigation';

export default function NumberingNewPage() {
  // Redirect to the correct numbering new location
  redirect('/admin/doc-control/numbering/new');
}
