import ClassesPageContentDebug from '../components/classes-content-debug';
import { getLocalizedDictionary } from '@/modules/site-content/services/site-content-service';
import { DevOnlyGuard } from '@/components/dev-only-guard';

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default async function DebugClassesPage() {
  const dict = await getLocalizedDictionary('es');

  return (
    <DevOnlyGuard>
      <ClassesPageContentDebug lang="es" dict={dict} />
    </DevOnlyGuard>
  );
}