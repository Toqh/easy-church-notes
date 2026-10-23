import { env } from "cloudflare:workers";
export function serverEnv(key: string): string { return (env as unknown as Record<string,string|undefined>)[key] ?? process.env[key] ?? ""; }
