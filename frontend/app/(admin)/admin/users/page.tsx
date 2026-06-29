'use client';

import { redirect } from 'next/navigation';

export default function UsersPage() {
  // Redirect to the correct users location
  redirect('/admin/access-control/users');
}
