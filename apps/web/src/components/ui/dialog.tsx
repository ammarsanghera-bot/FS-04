import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-stone-950/40" />
      <DialogPrimitive.Content className={`fixed left-1/2 top-1/2 z-50 w-[min(560px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-xl ${className}`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <DialogPrimitive.Title className="font-display text-xl font-semibold">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close className="rounded-md p-1 text-stone-500 hover:bg-accent" aria-label="Close">
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
