import { portalResponse } from "@/lib/billing/http";
export async function POST() { return portalResponse("STRIPE"); }
