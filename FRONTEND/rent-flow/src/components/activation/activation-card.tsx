"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useActivation } from "@/hooks/useAuth";

export function ActivationCard({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");
  const missingParams = !uid || !token;

  const { activate, isLoading, error, activated } = useActivation();
  const hasAttemptedRef = useRef(false);

  useEffect(() => {
    if (missingParams) return;
    if (hasAttemptedRef.current) return;
    hasAttemptedRef.current = true;
    activate({ uid: uid!, token: token! }).catch(() => {
      // L'erreur est déjà gérée par le hook
    });
  }, [activate, missingParams, token, uid]);

  const title = "Activation du compte";

  let description = "Nous activons automatiquement votre compte.";
  if (missingParams) {
    description = "Lien d'activation invalide ou incomplet.";
  } else if (activated) {
    description = "Votre compte est maintenant activé.";
  } else if (error) {
    description = "L'activation a échoué.";
  }

  return (
    <Card className={cn("w-full", className)} {...props}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {missingParams && (
          <p className="text-sm text-muted-foreground">
            Vérifiez que le lien provient bien de l'email d'activation.
          </p>
        )}

        {!missingParams && isLoading && (
          <p className="text-sm text-muted-foreground">
            Activation en cours, veuillez patienter...
          </p>
        )}

        {activated && (
          <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
            <span className="flex size-5 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              ✓
            </span>
            Compte activé avec succès.
          </div>
        )}

        {error && (
          <p className="text-sm text-red-500">
            {error.message}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {missingParams ? (
          <>
            <Button asChild variant="outline">
              <Link href="/auth/signup">Créer un compte</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/login">Retour à la connexion</Link>
            </Button>
          </>
        ) : activated ? (
          <Button asChild>
            <Link href="/auth/login">Se connecter</Link>
          </Button>
        ) : (
          <>
            <Button
              type="button"
              onClick={() => {
                if (!uid || !token || isLoading) return;
                activate({ uid, token }).catch(() => {
                  // L'erreur est déjà gérée par le hook
                });
              }}
              disabled={isLoading}
            >
              {isLoading ? "Activation..." : "Réessayer"}
            </Button>
            <Button asChild variant="ghost">
              <Link href="/auth/login">Retour à la connexion</Link>
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
