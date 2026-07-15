"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  const { t } = useI18n();
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
      <DialogPrimitive.Content className={cn("fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-[2rem] bg-white p-6 shadow-2xl md:left-1/2 md:top-1/2 md:bottom-auto md:w-[520px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[2rem]", className)} {...props}>
        {children}
        <DialogPrimitive.Close className="absolute right-5 top-5 flex size-10 items-center justify-center rounded-full bg-zinc-100" aria-label={t("关闭")}><X className="size-4" /></DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
