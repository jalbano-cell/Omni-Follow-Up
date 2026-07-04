import { Zap } from "lucide-react";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="size-5" strokeWidth={2.5} />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">FollowUpQuote</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
