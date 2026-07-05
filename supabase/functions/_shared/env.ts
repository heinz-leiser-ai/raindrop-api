type DenoEnv = {
  get?: (name: string) => string | undefined
}

const denoEnv = (globalThis as { Deno?: { env?: DenoEnv } }).Deno?.env

export function getEnv(name: string): string | undefined {
  return denoEnv?.get?.(name)
}
