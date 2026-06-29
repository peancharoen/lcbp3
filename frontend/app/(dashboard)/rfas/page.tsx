import { redirect } from 'next/navigation';

export default function RFAsPage() {
  redirect('/correspondences?type=RFA');
}
