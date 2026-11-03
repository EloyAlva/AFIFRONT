import { z } from "zod";

export const newPassword = z
  .string()
  .min(12, "Usa al menos 12 caracteres.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "La contraseña debe ocupar como máximo 72 bytes.",
  );

export function passwordFormSchema(recovery: boolean) {
  return z
    .object({
      currentPassword: z.string(),
      password: newPassword,
      confirmation: z.string(),
      nonce: z.string(),
    })
    .superRefine((value, ctx) => {
      if (!recovery && !value.currentPassword)
        ctx.addIssue({
          code: "custom",
          path: ["currentPassword"],
          message: "Ingresa tu contraseña actual.",
        });
      if (!recovery && value.currentPassword === value.password)
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message: "Elige una contraseña diferente a la actual.",
        });
      if (value.password !== value.confirmation)
        ctx.addIssue({
          code: "custom",
          path: ["confirmation"],
          message: "Las contraseñas no coinciden.",
        });
    });
}

export function passwordError(error: {
  code?: string;
  message: string;
}): string {
  const messages: Record<string, string> = {
    invalid_credentials: "La contraseña actual no es correcta.",
    invalid_password: "La contraseña actual no es correcta.",
    same_password: "Elige una contraseña diferente a la actual.",
    weak_password:
      "La nueva contraseña no cumple los requisitos de seguridad de Supabase.",
    reauthentication_needed:
      "Confirma tu identidad con el código enviado a tu correo.",
    reauthentication_not_valid:
      "El código no es válido o ha vencido. Solicita uno nuevo.",
    session_not_found:
      "Tu sesión venció. Inicia sesión de nuevo o solicita otro enlace de recuperación.",
    refresh_token_not_found:
      "Tu sesión venció. Solicita otro enlace de recuperación.",
    user_banned: "Esta cuenta no tiene acceso. Contacta al administrador.",
    over_email_send_rate_limit:
      "Espera unos minutos antes de solicitar otro código.",
  };
  return messages[error.code ?? ""] ?? error.message;
}
