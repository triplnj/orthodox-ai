import LoginForm from "@/components/auth/LoginForm";
import { guardAuthenticationPage } from "@/lib/security/auth-page";
export default async function LoginPage() {
  await guardAuthenticationPage();
  return <LoginForm />;
}
