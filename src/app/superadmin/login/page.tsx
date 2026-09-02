import { SuperadminLoginForm } from "./login-form";

export default function SuperadminLoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-950 px-6 py-16">
      <div className="mb-6 text-center">
        <p className="text-sm font-medium text-emerald-400">SportControl</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-50">Panel de plataforma</h1>
      </div>
      <SuperadminLoginForm />
    </div>
  );
}
