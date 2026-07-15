import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return <main className="grid min-h-screen md:grid-cols-2"><div className="flex items-center justify-center px-6 py-12"><Suspense><AuthForm mode="signup" /></Suspense></div><div className="relative hidden overflow-hidden bg-black md:block"><div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,#444_0,transparent_35%),radial-gradient(circle_at_80%_75%,#222_0,transparent_40%)]" /><div className="absolute bottom-12 left-12 max-w-md text-white"><p className="text-xs uppercase tracking-[.22em] text-white/45">CoffeeBar member</p><p className="mt-4 text-6xl font-semibold leading-[.9] tracking-[-.07em]">Every cup<br />counts.</p></div></div></main>;
}
