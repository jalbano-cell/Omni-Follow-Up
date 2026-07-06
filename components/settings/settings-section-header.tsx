import type { LucideIcon } from "lucide-react";
import { AccordionTrigger } from "@/components/ui/accordion";

export function SettingsSectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <AccordionTrigger className="px-4 sm:px-5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4.5" strokeWidth={2} />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="font-heading text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
    </AccordionTrigger>
  );
}
