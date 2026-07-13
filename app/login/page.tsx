import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/layout/logo";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const { error, from } = await searchParams;
  const rateLimited = error === "rate";

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Logo size="md" withWordmark={false} />
          <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground">Omni Follow Up</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>
        <LoginForm hasError={error === "1"} rateLimited={rateLimited} redirectTo={from ?? "/"} />
      </div>
    </div>
  );
}
