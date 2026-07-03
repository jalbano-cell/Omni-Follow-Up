"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/estimates/submit-button";
import { loginAction } from "@/app/login/actions";

export function LoginForm({ hasError, redirectTo }: { hasError: boolean; redirectTo: string }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Card className="py-6">
      <CardContent className="px-6">
        <form action={loginAction} className="flex flex-col gap-4">
          <input type="hidden" name="from" value={redirectTo} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoFocus
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
            {hasError && <p className="text-xs text-destructive">Incorrect password.</p>}
          </div>

          <SubmitButton>Sign in</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
