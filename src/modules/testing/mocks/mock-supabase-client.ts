import { vi } from "vitest"

export type MockQueryCall = {
  method: string
  args: unknown[]
}

export type MockSupabaseResponse<T = unknown> = {
  data?: T | null
  error?: unknown
  count?: number | null
}

type AuthUserResult = {
  data: { user: { id: string; email: string } | null }
  error: unknown
}

type AuthSessionResult = {
  data: { session: { user: { id: string } } | null }
  error: unknown
}

type SignOutParams = {
  scope?: "local" | "global"
}

type SignOutResult = {
  error: unknown
}

class MockQuery<T = unknown> {
  readonly operations: MockQueryCall[] = []
  private readonly response: MockSupabaseResponse<T>

  constructor(response: MockSupabaseResponse<T>) {
    this.response = response
  }

  private record(method: string, args: unknown[]) {
    this.operations.push({ method, args })
    return this
  }

  select = vi.fn((...args: unknown[]) => this.record("select", args));

  eq = vi.fn((...args: unknown[]) => this.record("eq", args));

  neq = vi.fn((...args: unknown[]) => this.record("neq", args));

  ["in"] = vi.fn((...args: unknown[]) => this.record("in", args));

  order = vi.fn((...args: unknown[]) => this.record("order", args));

  limit = vi.fn((...args: unknown[]) => this.record("limit", args));

  insert = vi.fn((...args: unknown[]) => this.record("insert", args));

  update = vi.fn((...args: unknown[]) => this.record("update", args));

  delete = vi.fn((...args: unknown[]) => this.record("delete", args));

  single = vi.fn(() => {
    this.operations.push({ method: "single", args: [] })
    return Promise.resolve(this.response)
  })

  then(onFulfilled?: (value: MockSupabaseResponse<T>) => unknown, onRejected?: (reason: unknown) => unknown) {
    this.operations.push({ method: "then", args: [] })
    return Promise.resolve(this.response).then(onFulfilled, onRejected)
  }

  catch(onRejected?: (reason: unknown) => unknown) {
    return Promise.resolve(this.response).catch(onRejected)
  }
}

type QueuedResponse<T = unknown> = {
  table?: string
  response: MockSupabaseResponse<T>
}

type StorageResponse = {
  data?: { path: string } | null
  error?: unknown
}

export class MockSupabaseClient {
  private queue: QueuedResponse[] = []
  private storageQueue: StorageResponse[] = []

  readonly queries: Array<{ table: string; query: MockQuery }> = []

  readonly from = vi.fn((table: string) => {
    const queued = this.dequeue(table)
    const query = new MockQuery(queued.response)
    query.operations.push({ method: "from", args: [table] })
    this.queries.push({ table, query })
    return query
  })

  readonly storage = {
    from: vi.fn((bucket: string) => {
      const upload = vi.fn(async (_path: string, _file: File) => {
        const { data = { path: `${bucket}/mock-file.png` }, error = null } = this.storageQueue.shift() ?? {}
        if (error) {
          return { data: null, error }
        }
        return { data, error: null }
      })

      const getPublicUrl = vi.fn((path: string) => ({
        data: { publicUrl: `https://cdn.local/${path}` },
      }))

      return {
        upload,
        getPublicUrl,
      }
    }),
  }

  readonly auth = {
    getUser: vi.fn<() => Promise<AuthUserResult>>(async () => ({
      data: { user: { id: "user-123", email: "user@example.com" } },
      error: null,
    })),
    getSession: vi.fn<() => Promise<AuthSessionResult>>(async () => ({
      data: { session: { user: { id: "user-123" } } },
      error: null,
    })),
    signOut: vi.fn<(params?: SignOutParams) => Promise<SignOutResult>>(async () => ({
      error: null,
    })),
  }

  queueResponse<T>(response: MockSupabaseResponse<T>, table?: string) {
    this.queue.push({ table, response })
    return this
  }

  queueStorageResponse(response: StorageResponse) {
    this.storageQueue.push(response)
    return this
  }

  reset() {
    this.queue = []
    this.storageQueue = []
    this.queries.length = 0
    this.from.mockClear()
    this.storage.from.mockClear()
    this.auth.getUser.mockClear()
    this.auth.getSession.mockClear()
    this.auth.signOut.mockClear()
  }

  private dequeue(requestedTable: string) {
    if (this.queue.length === 0) {
      throw new Error(`No queued response available for table "${requestedTable}"`)
    }

    const [next] = this.queue

    if (next.table && next.table !== requestedTable) {
      throw new Error(`Expected next response for table "${next.table}" but got request for "${requestedTable}"`)
    }

    this.queue.shift()
    return next
  }
}
