import { SignupForm } from "@/components/auth/signup-form";
import { Logo } from "@/components/layout/logo";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Logo size="md" withWordmark={false} />
          <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground">OmniFollowUp</h1>
          <p className="text-sm text-muted-foreground">Create your account</p>
        </div>
        <SignupForm error={error} />
      </div>
    </div>
  );
}
