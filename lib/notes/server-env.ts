// Vercel/Next.js server runtime. Vite selects the Cloudflare implementation.
export function serverEnv(key: string): string { return process.env[key] ?? ""; }
