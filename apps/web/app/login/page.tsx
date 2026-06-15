import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { AuthRedirectIfLoggedIn } from "@/components/auth/auth-redirect-if-logged-in";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in — Devin",
  description: "Sign in to your Devin account with a magic link",
};

export default function LoginPage() {
  return (
    <AuthRedirectIfLoggedIn>
      <AuthPageShell
        title="Welcome to Devin"
        subtitle="Enter your email and we'll send you a secure sign-in link"
      >
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </AuthPageShell>
    </AuthRedirectIfLoggedIn>
  );
}
