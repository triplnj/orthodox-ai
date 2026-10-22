import { authenticationResponse } from "@/lib/security/auth-http";
export async function PATCH(req: Request) { return authenticationResponse(req, "password"); }
