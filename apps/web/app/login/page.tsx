import type { Metadata } from "next";
import {
  AuthFooterLink,
  AuthPageShell,
} from "@/components/auth/auth-page-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in — Devin",
  description: "Sign in to your Devin account",
};

export default function LoginPage() {
  return (
    <AuthPageShell
      title="Welcome to Devin"
      subtitle="Sign in to your account"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <AuthFooterLink href="/signup">Sign up</AuthFooterLink>
        </>
      }
    >
      <LoginForm />
    </AuthPageShell>
  );
}
