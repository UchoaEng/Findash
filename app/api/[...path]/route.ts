import { env } from "cloudflare:workers";
import { handleRequest } from "@/lib/server";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return handleRequest(request, env.DB as D1Database);
}
export function POST(request: Request) {
  return handleRequest(request, env.DB as D1Database);
}
