import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        default: "bg-black text-white hover:bg-zinc-800",
        outline: "border bg-white text-black hover:bg-zinc-100",
        ghost: "text-black hover:bg-black/5",
        soft: "bg-zinc-100 text-black hover:bg-zinc-200",
        destructive: "bg-red-600 text-white hover:bg-red-700",
      },
      size: { default: "h-11", sm: "min-h-9 px-4 text-xs", lg: "h-13 px-7 text-base", icon: "size-11 p-0" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
