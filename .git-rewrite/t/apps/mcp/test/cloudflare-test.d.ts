declare module 'cloudflare:test' {
  export const env: any
  export function runInDurableObject<T>(
    stub: any,
    fn: (instance: T) => Promise<void> | void
  ): Promise<void>
  export function createExecutionContext(): ExecutionContext
  export function waitOnExecutionContext(ctx: ExecutionContext): Promise<void>
}
