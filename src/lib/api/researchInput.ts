import "server-only";
import { z } from "zod";
import { idSchema, parse, queryInput } from "./validation";
const query = z.string().trim().min(1).max(2000);
export function researchInput(request: Request, body: Record<string, unknown>) {
  queryInput(request);
  const name = new URL(request.url).pathname.split("/").at(-1);
  const schema = name === "collect" ? z.strictObject({ url: z.url().max(2048) })
    : ["start-workflow-test", "process-job-test"].includes(name ?? "") ? z.strictObject({ jobId: idSchema })
    : name === "jobs" ? z.union([z.strictObject({ jobId: idSchema }), z.strictObject({ query, language: z.enum(["en", "sr"]).optional() })])
    : ["backfill-translations", "embed", "repair", "verify"].includes(name ?? "") ? z.strictObject({})
    : z.strictObject({ query, language: z.enum(["en", "sr"]).optional() });
  return parse(schema as z.ZodType<Record<string, unknown>>, body);
}
