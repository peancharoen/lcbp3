'use client';

import { redirect } from 'next/navigation';

export default function NumberingPage() {
  // Redirect to the correct numbering location
  redirect('/admin/doc-control/numbering');
}
