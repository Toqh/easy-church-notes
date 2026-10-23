import { serverEnv } from "@/lib/notes/server-env";
export function GET() {
  const url=serverEnv("SUPABASE_URL"), key=serverEnv("SUPABASE_PUBLISHABLE_KEY");
  return Response.json({supabaseUrl:url,supabaseKey:key,authConfigured:!!(url&&key),bibleConfigured:true},{headers:{"Cache-Control":"no-store"}});
}
