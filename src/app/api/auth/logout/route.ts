import { apiJson } from "@/lib/api/response";
import { destroySession } from "@/lib/session";

export async function POST() {
  await destroySession();

  return apiJson({
    success: true,
  });
}