export function SettingsSectionContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-t border-border px-4 py-4 sm:px-5">
      {children}
    </div>
  );
}
