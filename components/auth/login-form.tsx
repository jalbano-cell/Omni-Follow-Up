"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/estimates/submit-button";
import { loginAction } from "@/app/login/actions";

export function LoginForm({
  hasError,
  rateLimited = false,
  redirectTo,
}: {
  hasError: boolean;
  rateLimited?: boolean;
  redirectTo: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Card className="py-6">
      <CardContent className="px-6">
        <form action={loginAction} className="flex flex-col gap-4">
          <input type="hidden" name="from" value={redirectTo} />

          {rateLimited && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Too many attempts. Please wait a few minutes and try again.
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoFocus aria-invalid={hasError} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                aria-invalid={hasError}
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {hasError && <p className="text-xs text-destructive">Incorrect email or password.</p>}
          </div>

          <SubmitButton>Sign in</SubmitButton>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
