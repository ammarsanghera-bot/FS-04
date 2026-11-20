import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Sheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-stone-950/30" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-[min(520px,100%)] flex-col border-l border-border bg-[#fffdf9] shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <DialogPrimitive.Title className="font-display text-lg font-semibold">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-md p-1 text-stone-500 hover:bg-accent" aria-label="Close">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
