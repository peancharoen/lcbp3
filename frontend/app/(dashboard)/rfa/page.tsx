import { redirect } from 'next/navigation';

export default function RfaLegacyPage() {
  redirect('/correspondences?type=RFA');
}
