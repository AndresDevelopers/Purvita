import { redirect } from 'next/navigation';

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function AdminInvoicesPage() {
  // Redirect to orders page where invoices can be generated
  redirect('/admin/orders');
}

