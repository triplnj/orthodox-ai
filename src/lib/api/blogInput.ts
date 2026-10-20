import "server-only";
import { ApiError, parse, idSchema } from "./validation";
export function blogForm(form: FormData, mode: "create" | "update" | "delete") {
  const limits: Record<string, number> = mode === "delete" ? { id: 128 } : { id: 128, title: 300, slug: 200, excerpt: 2000, category: 100, content: 524288, status: 20 };
  let bytes = 0;
  for (const [key, value] of form) {
    if (key.startsWith("$ACTION_")) continue;
    if (!Object.hasOwn(limits, key) || form.getAll(key).length !== 1 || typeof value !== "string" || value.length > limits[key]) throw new ApiError("Invalid or oversized blog field.");
    bytes += Buffer.byteLength(value, "utf8");
  }
  if (bytes > 600000) throw new ApiError("Blog submission is too large.", 413, "PAYLOAD_TOO_LARGE");
  if (mode !== "create") parse(idSchema, form.get("id"));
  if (mode !== "delete") {
    if (typeof form.get("title") !== "string" || !String(form.get("title")).trim() || typeof form.get("content") !== "string" || !String(form.get("content")).trim()) throw new ApiError("Blog title and content are required.");
    if (form.has("status") && !["DRAFT", "PUBLISHED"].includes(String(form.get("status")))) throw new ApiError("Invalid blog status.");
  }
}
