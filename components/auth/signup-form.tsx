"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/estimates/submit-button";
import { signupAction } from "@/app/signup/actions";

export function SignupForm({ error }: { error?: string }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Card className="py-6">
      <CardContent className="px-6">
        <form action={signupAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="businessName">Business name</Label>
            <Input id="businessName" name="businessName" required autoFocus />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ownerName">Your name</Label>
            <Input id="ownerName" name="ownerName" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ownerEmail">Email</Label>
            <Input id="ownerEmail" name="ownerEmail" type="email" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={10}
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

          <SubmitButton>Create account</SubmitButton>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
