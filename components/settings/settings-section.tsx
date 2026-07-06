import type { LucideIcon } from "lucide-react";
import { AccordionItem, AccordionContent } from "@/components/ui/accordion";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { SettingsSectionContent } from "@/components/settings/settings-section-content";

export function SettingsSection({
  value,
  icon,
  title,
  description,
  children,
}: {
  value: string;
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value} className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <SettingsSectionHeader icon={icon} title={title} description={description} />
      <AccordionContent>
        <SettingsSectionContent>{children}</SettingsSectionContent>
      </AccordionContent>
    </AccordionItem>
  );
}
