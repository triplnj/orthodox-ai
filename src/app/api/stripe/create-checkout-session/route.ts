import { checkoutResponse } from "@/lib/billing/http";
export async function POST() { return checkoutResponse("STRIPE"); }
