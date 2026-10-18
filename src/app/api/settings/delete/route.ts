import { deletionResponse } from "@/lib/billing/http";
export async function DELETE(req: Request) { return deletionResponse(req); }
