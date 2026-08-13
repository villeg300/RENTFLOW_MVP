import { normalizeError } from "@/lib/axios"

export function getErrorMessage(
  error: unknown,
  fallback = "Une erreur est survenue."
) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  const normalizedError = normalizeError(error)
  return normalizedError.message || fallback
}
