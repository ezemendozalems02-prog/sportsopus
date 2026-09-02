import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="mb-6 text-center">
        <Link href="/" className="text-sm text-zinc-500 dark:text-zinc-400">
          ← SportControl
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Iniciar sesión</h1>
      </div>
      <LoginForm />
      <p className="mt-6 text-center text-xs text-zinc-400">
        Cuenta demo: martin@palermo.club / demo1234
      </p>
    </div>
  );
}
