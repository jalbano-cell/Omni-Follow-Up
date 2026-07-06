"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/estimates/submit-button";
import { acceptInviteAction } from "@/app/invite/[token]/actions";

export function InviteAcceptForm({ token, email, error }: { token: string; email: string; error?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const boundAction = acceptInviteAction.bind(null, token);

  return (
    <Card className="py-6">
      <CardContent className="px-6">
        <form action={boundAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input readOnly disabled value={email} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Set a password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={10}
                autoFocus
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
            <p className="text-xs text-muted-foreground">At least 10 characters, with letters and numbers.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              required
              minLength={10}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <SubmitButton>Join workspace</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
