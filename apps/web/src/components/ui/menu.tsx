import * as Dropdown from "@radix-ui/react-dropdown-menu";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Menu = Dropdown.Root;
export const MenuTrigger = Dropdown.Trigger;

export function MenuContent({ children }: { children: ReactNode }) {
  return (
    <Dropdown.Portal>
      <Dropdown.Content className="z-50 min-w-52 rounded-xl border border-border bg-white p-1 shadow-lg" sideOffset={8} align="end">
        {children}
      </Dropdown.Content>
    </Dropdown.Portal>
  );
}

export function MenuItem({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) {
  return (
    <Dropdown.Item className="cursor-pointer rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-accent" onSelect={onSelect}>
      {children}
    </Dropdown.Item>
  );
}

export const Tabs = TabsPrimitive.Root;

export function TabsList({ children }: { children: ReactNode }) {
  return <TabsPrimitive.List className="flex gap-1 rounded-xl bg-[#ebe4d8] p-1">{children}</TabsPrimitive.List>;
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold text-stone-600 data-[state=active]:bg-white data-[state=active]:text-stone-900")}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

export const TabsContent = TabsPrimitive.Content;
