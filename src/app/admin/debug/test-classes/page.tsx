import TestVideos from '../components/test-videos';
import { DevOnlyGuard } from '@/components/dev-only-guard';

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function TestClassesPage() {
  return (
    <DevOnlyGuard>
      <TestVideos />
    </DevOnlyGuard>
  );
}