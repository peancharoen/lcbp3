'use client';

import { redirect } from 'next/navigation';

export default function OrganizationsPage() {
  // Redirect to the correct organizations location
  redirect('/admin/access-control/organizations');
}
