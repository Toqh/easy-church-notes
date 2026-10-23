import { BibleError } from "@/lib/notes/youversion";
import { createBibleService } from "@/lib/notes/bible-service";
import { serverEnv } from "@/lib/notes/server-env";
export async function GET(request: Request) {
  const params=new URL(request.url).searchParams;
  const bible=createBibleService(serverEnv("YOUVERSION_APP_KEY"),fetch,{apiBibleKey:serverEnv("API_BIBLE_KEY"),apiBibleBaseUrl:serverEnv("API_BIBLE_BASE_URL")});
  try {
    const action=params.get("action"), version=Number(params.get("version")); let result;
    if(action==="versions") result=await bible.catalogue();
    else if(action==="passage") result=await bible.passage(version,params.get("reference")??"");
    else if(action==="search") result=await bible.search(version,params.get("query")??"",params.get("page")??"");
    else throw new BibleError("Unknown Bible action.",400);
    return Response.json(result,{headers:{"Cache-Control":"private, no-store"}});
  } catch(error) {
    const known=error instanceof BibleError;
    return Response.json({error:known?error.message:"Bible lookup timed out or could not connect. Please try again."},{status:known?error.status:502,headers:{"Cache-Control":"no-store",...(known&&error.retryAfter?{"Retry-After":error.retryAfter}:{})}});
  }
}
