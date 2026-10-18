import RegisterForm from "@/components/auth/RegisterForm";
import { guardAuthenticationPage } from "@/lib/security/auth-page";
export default async function RegisterPage() {
  await guardAuthenticationPage();
  return <RegisterForm />;
}
