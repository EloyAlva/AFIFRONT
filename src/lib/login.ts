import { z } from "zod";

const username = z.string().regex(/^[a-z0-9][a-z0-9._-]*$/);

/** Supabase always receives an email; the login may accept its local username. */
export function normalizeLoginEmail(input: string): string {
  const value = input.trim().toLowerCase();
  if (value.includes("@")) return z.email().parse(value);
  if (!username.safeParse(value).success) {
    throw new Error("Ingresa un usuario válido, como mramirez o ealva.");
  }
  return `${value}@afi.com`;
}
