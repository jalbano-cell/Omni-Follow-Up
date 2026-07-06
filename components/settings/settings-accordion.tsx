"use client";

import { useEffect, useState } from "react";
import { Accordion } from "@/components/ui/accordion";

/** sessionStorage (not localStorage) — "remember the last opened section during the session" only, per spec. */
const STORAGE_KEY = "omnifollowup:settings-open-section";

export function SettingsAccordion({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    setValue(stored ? [stored] : []);
    setHydrated(true);
  }, []);

  return (
    <Accordion
      value={hydrated ? value : []}
      onValueChange={(next: string[]) => {
        setValue(next);
        const [opened] = next;
        if (opened) {
          sessionStorage.setItem(STORAGE_KEY, opened);
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }}
      className="flex flex-col gap-3"
    >
      {children}
    </Accordion>
  );
}
