import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() { return <main className="grid min-h-screen md:grid-cols-2"><div className="flex items-center justify-center px-6 py-12"><Suspense><AuthForm mode="login" /></Suspense></div><div className="relative hidden overflow-hidden bg-black md:block"><div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,#444_0,transparent_35%),radial-gradient(circle_at_20%_80%,#222_0,transparent_40%)]" /><div className="absolute bottom-12 left-12 max-w-md text-white"><p className="text-xs uppercase tracking-[.22em] text-white/45">Coffee is a ritual</p><p className="mt-4 text-6xl font-semibold leading-[.9] tracking-[-.07em]">The pause<br />you keep.</p></div></div></main>; }
