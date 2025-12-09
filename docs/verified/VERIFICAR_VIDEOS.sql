## Error Type
Console TypeError

## Error Message
Failed to fetch


    at AdminVideoClientService.loadVideos (../Multi Nivel/src/lib/services/admin-video-client-service.ts:16:28)
    at useAdminVideos.useCallback[loadVideos] (../Multi Nivel/src/hooks/use-admin-videos.ts:25:50)
    at useAdminVideos.useEffect (../Multi Nivel/src/hooks/use-admin-videos.ts:83:5)

## Code Frame
  14 |     try {
  15 |       // Try localized endpoint first
> 16 |       let response = await fetch(`/api/admin/videos/localized?locale=${locale}`, { 
     |                            ^
  17 |         cache: 'no-store' 
  18 |       });
  19 |

Next.js version: 15.5.4 (Turbopack)
