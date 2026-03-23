"use client";

import { useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useRequestPasswordReset } from "@/hooks/useAuth";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const { submit, isLoading, error, emailSent } = useRequestPasswordReset();
  const [sentEmail, setSentEmail] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = (form.get("email") as string) ?? "";
    try {
      await submit({ email });
      setSentEmail(email);
    } catch {
      // L'erreur est déjà gérée par le hook
    }
  };

  if (emailSent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center py-8">
        <div className="flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
          <svg
            className="size-6 text-green-600 dark:text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold">Email envoyé</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          {sentEmail
            ? `Si un compte existe pour ${sentEmail}, un lien de réinitialisation vient d'être envoyé.`
            : "Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé."}
        </p>
        <Link
          href="/auth/login"
          className="text-sm font-medium underline underline-offset-4"
        >
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Mot de passe oublié</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Entrez votre adresse email pour recevoir un lien de réinitialisation
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center rounded-md bg-red-50 dark:bg-red-950 px-3 py-2">
            {error.message}
          </p>
        )}

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="example@gmail.com"
            required
            disabled={isLoading}
            className="bg-background"
          />
          <FieldDescription>
            Vous recevrez un lien de réinitialisation valable pendant un temps limité.
          </FieldDescription>
        </Field>

        <Field>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Envoi en cours..." : "Envoyer le lien"}
          </Button>
        </Field>

        <FieldDescription className="text-center">
          Vous vous souvenez de votre mot de passe ?{" "}
          <Link href="/auth/login" className="underline underline-offset-4">
            Se connecter
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
