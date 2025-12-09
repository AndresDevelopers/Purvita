import { redirect } from 'next/navigation';

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function AdminPaymentsPage() {
  redirect('/admin/payments/history');
}

