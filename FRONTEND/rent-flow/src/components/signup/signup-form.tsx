"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRegister } from "@/hooks/useAuth";
import { AuthGuard } from "@/components/AuthGuard";

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const { submit, isLoading, error, registered } = useRegister();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    await submit({
      full_name: form.get("full_name") as string,
      email: form.get("email") as string,
      phone_number: form.get("phone_number") as string,
      password: form.get("password") as string,
      re_password: form.get("re_password") as string,
    });
  };

  if (registered) {
    return (
      <div className="flex flex-col items-center gap-4 text-center py-8">
        <div className="flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
          <svg className="size-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold">Compte créé avec succès !</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Un email d'activation vous a été envoyé. Consultez votre boîte mail
          et cliquez sur le lien pour activer votre compte.
        </p>
        <Link href="/auth/login" className="text-sm font-medium underline underline-offset-4">
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <AuthGuard redirectIfAuthenticated="/dashboard">
      <form onSubmit={handleSubmit} className={cn("flex flex-col gap-6", className)} {...props}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="text-2xl font-bold">Créez votre compte</h1>
            <p className="text-sm text-balance text-muted-foreground">
              Remplissez les champs pour créer un compte
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center rounded-md bg-red-50 dark:bg-red-950 px-3 py-2">
              {error.message}
            </p>
          )}

          <Field>
            <FieldLabel htmlFor="full_name">Nom complet</FieldLabel>
            <Input
              id="full_name"
              name="full_name"
              type="text"
              placeholder="John Doe"
              required
              disabled={isLoading}
              className="bg-background"
            />
          </Field>

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
          </Field>

          <Field>
            <FieldLabel htmlFor="phone_number">Numéro de téléphone</FieldLabel>
            <Input
              id="phone_number"
              name="phone_number"
              type="tel"
              placeholder="70-25-34-56"
              required
              disabled={isLoading}
              className="bg-background"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              required
              disabled={isLoading}
              className="bg-background"
            />
            <FieldDescription>Doit contenir au moins 8 caractères.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="re_password">Confirmer le mot de passe</FieldLabel>
            <Input
              id="re_password"
              name="re_password"
              type="password"
              required
              disabled={isLoading}
              className="bg-background"
            />
            <FieldDescription>Veuillez confirmer votre mot de passe.</FieldDescription>
          </Field>

          <Field>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Création en cours..." : "Créer un compte"}
            </Button>
          </Field>

          <FieldSeparator>Ou continuer avec</FieldSeparator>

          <Field>
            <Button variant="outline" type="button" className="w-full" disabled={isLoading}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              S'inscrire avec Google
            </Button>
            <FieldDescription className="px-6 text-center">
              Vous avez déjà un compte?{" "}
              <Link href="/auth/login" className="underline underline-offset-4">
                Se connecter
              </Link>
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
    </AuthGuard>
  );
}