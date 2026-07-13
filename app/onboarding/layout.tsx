import { Logo } from "@/components/layout/logo";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Logo size="md" withWordmark={false} />
          <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground">Omni Follow Up</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
