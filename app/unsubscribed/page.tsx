import { Logo } from "@/components/layout/logo";

export const dynamic = "force-dynamic";

/**
 * Static confirmation page after app/api/unsubscribe/[token] processes a
 * click — public, no session (see middleware.ts's PUBLIC_PATHS).
 */
export default async function UnsubscribedPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const succeeded = ok !== "0";

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Logo size="md" withWordmark={false} />
        </div>

        {succeeded ? (
          <>
            <h2 className="mb-2 text-base font-semibold text-foreground">You&apos;re unsubscribed</h2>
            <p className="text-sm text-muted-foreground">
              You won&apos;t receive any further automated emails from this business.
            </p>
          </>
        ) : (
          <>
            <h2 className="mb-2 text-base font-semibold text-foreground">This link is invalid</h2>
            <p className="text-sm text-muted-foreground">
              This unsubscribe link couldn&apos;t be verified. If you keep receiving unwanted emails, reply directly and
              ask to be removed.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
