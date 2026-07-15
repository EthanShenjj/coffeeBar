import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn("h-12 w-full rounded-xl border bg-white px-4 text-[16px] outline-none placeholder:text-zinc-400 focus:border-black", className)} {...props} />;
}
export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn("min-h-24 w-full resize-none rounded-xl border bg-white px-4 py-3 text-[16px] outline-none placeholder:text-zinc-400 focus:border-black", className)} {...props} />;
}
