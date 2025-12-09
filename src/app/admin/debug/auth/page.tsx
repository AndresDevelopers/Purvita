import AuthDebug from '@/components/auth-debug';
import { DevOnlyGuard } from '@/components/dev-only-guard';

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function AuthDebugPage() {
  return (
    <DevOnlyGuard>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Debug de Autenticación</h1>
        <AuthDebug />
      </div>
    </DevOnlyGuard>
  );
}