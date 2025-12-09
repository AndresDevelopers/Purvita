declare module 'https://deno.land/std@0.224.0/http/server.ts' {
  export interface ServeInit {
    hostname?: string
    port?: number
    signal?: AbortSignal
    onListen?: (params: { hostname: string; port: number }) => void
  }

  export type Handler = (request: Request) => Response | Promise<Response>

  export function serve(handler: Handler, options?: ServeInit): Promise<void>
}

declare module 'https://esm.sh/@supabase/supabase-js@2.57.4' {
  export * from '@supabase/supabase-js'
}

declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}
