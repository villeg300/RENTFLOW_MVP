"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useConfirmPasswordReset } from "@/hooks/useAuth";

export function ResetPasswordForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const searchParams = useSearchParams();
  const [paramsReady, setParamsReady] = useState(false);
  const [params, setParams] = useState({ uid: "", token: "" });

  const { submit, isLoading, error, confirmed } = useConfirmPasswordReset();
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const uid = searchParams.get("uid") ?? searchParams.get("uidb64") ?? "";
    const token = searchParams.get("token") ?? "";
    setParams({ uid, token });
    setParamsReady(true);
  }, [searchParams]);

  const missingParams = paramsReady && (!params.uid || !params.token);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);

    if (!params.uid || !params.token) {
      setLocalError("Lien de réinitialisation invalide ou expiré.");
      return;
    }

    const form = new FormData(e.currentTarget);
    const new_password = (form.get("new_password") as string) ?? "";
    const re_new_password = (form.get("re_new_password") as string) ?? "";

    if (new_password !== re_new_password) {
      setLocalError("Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      await submit({
        uid: params.uid,
        token: params.token,
        new_password,
        re_new_password,
      });
    } catch {
      // L'erreur est déjà gérée par le hook
    }
  };

  if (!paramsReady) {
    return (
      <div className="flex flex-col items-center gap-4 text-center py-8">
        <p className="text-sm text-muted-foreground">Chargement du lien...</p>
      </div>
    );
  }

  if (missingParams) {
    return (
      <div className="flex flex-col items-center gap-4 text-center py-8">
        <div className="flex size-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
          <svg
            className="size-6 text-red-600 dark:text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold">Lien invalide</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Le lien de réinitialisation est incomplet ou a expiré. Veuillez demander un
          nouveau lien.
        </p>
        <Link
          href="/auth/forgot-password"
          className="text-sm font-medium underline underline-offset-4"
        >
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  if (confirmed) {
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
        <h2 className="text-xl font-semibold">Mot de passe réinitialisé</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Votre mot de passe a été mis à jour avec succès. Vous pouvez vous connecter.
        </p>
        <Link
          href="/auth/login"
          className="text-sm font-medium underline underline-offset-4"
        >
          Se connecter
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
          <h1 className="text-2xl font-bold">Réinitialiser le mot de passe</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Choisissez un nouveau mot de passe pour votre compte
          </p>
        </div>

        {(localError || error) && (
          <p className="text-sm text-red-500 text-center rounded-md bg-red-50 dark:bg-red-950 px-3 py-2">
            {localError ?? error?.message}
          </p>
        )}

        <Field>
          <FieldLabel htmlFor="new_password">Nouveau mot de passe</FieldLabel>
          <Input
            id="new_password"
            name="new_password"
            type="password"
            required
            disabled={isLoading}
            className="bg-background"
          />
          <FieldDescription>Doit contenir au moins 8 caractères.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="re_new_password">Confirmer le mot de passe</FieldLabel>
          <Input
            id="re_new_password"
            name="re_new_password"
            type="password"
            required
            disabled={isLoading}
            className="bg-background"
          />
          <FieldDescription>Veuillez confirmer votre nouveau mot de passe.</FieldDescription>
        </Field>

        <Field>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Réinitialisation..." : "Mettre à jour le mot de passe"}
          </Button>
        </Field>

        <FieldDescription className="text-center">
          Vous avez retrouvé votre mot de passe ?{" "}
          <Link href="/auth/login" className="underline underline-offset-4">
            Se connecter
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
