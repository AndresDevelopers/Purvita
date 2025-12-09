 
import { NextResponse } from 'next/server';
import { createTreeService } from '@/modules/multilevel/factories/tree-service-factory';
import { EnvironmentConfigurationError } from '@/lib/env';
import { getAppSettings } from '@/modules/app-settings/services/app-settings-service';
import { withAuth } from '@/lib/auth/with-auth';

/**
 * GET /api/tree
 * SECURED: Uses Supabase session authentication
 */
export const GET = withAuth<unknown>(async (req) => {
  const userId = req.user.id;

  try {
    const treeService = createTreeService();
    const _settings = await getAppSettings();

    // Fetch multilevel tree based on app settings configuration
    // This single call replaces the previous N+1 pattern where we called both
    // fetchMultilevelTree and fetchTwoLevelTree separately
    // Using a fixed depth of 10 levels for the tree
    const maxLevels = 10;
    const multilevelData = await treeService.fetchMultilevelTree(userId, maxLevels);

    console.log('[API /tree] Fetched tree data:', {
      userId,
      maxLevels,
      levelsKeys: Object.keys(multilevelData.levels),
      level1Count: multilevelData.levels[1]?.length ?? 0,
      level2Count: multilevelData.levels[2]?.length ?? 0,
      maxLevel: multilevelData.maxLevel,
    });

    // Derive legacy format from multilevel data to maintain backward compatibility
    // without making an additional database call
    const level1 = multilevelData.levels[1] || [];
    const level2 = multilevelData.levels[2] || [];

    return NextResponse.json({
      // New multilevel format
      levels: multilevelData.levels,
      maxLevel: multilevelData.maxLevel,
      // Legacy format for backward compatibility (derived from multilevel data)
      level1,
      level2,
    });
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      console.error('Missing environment configuration for tree endpoint', error);
      return NextResponse.json(
        {
          error: 'environment-configuration-missing',
          message: error.message,
          missing: error.missingKeys,
        },
        { status: 503 },
      );
    }
    console.error('Failed to load tree data', error);
    return NextResponse.json({ error: 'Failed to load tree data' }, { status: 500 });
  }
});
