import { authenticationResponse } from "@/lib/security/auth-http";
export async function POST(req: Request) { return authenticationResponse(req, "resend"); }
