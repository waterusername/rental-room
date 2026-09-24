import { PASSWORD_HINT } from "@/lib/auth/password-rules";

export function PasswordHint() {
  return <span className="mt-1 block text-xs font-normal text-muted">{PASSWORD_HINT}</span>;
}
