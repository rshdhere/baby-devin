import type { Metadata } from "next";
import {
  AuthFooterLink,
  AuthPageShell,
} from "@/components/auth/auth-page-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Sign up — Devin",
  description: "Create a new Devin account",
};

export default function SignupPage() {
  return (
    <AuthPageShell
      title="Welcome to Devin"
      subtitle="Create a new account"
      footer={
        <>
          Already have an account?{" "}
          <AuthFooterLink href="/login">Log in</AuthFooterLink>
        </>
      }
    >
      <SignupForm />
    </AuthPageShell>
  );
}
