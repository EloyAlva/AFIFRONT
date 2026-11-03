"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { auth } from "@/lib/api";
import { passwordFormSchema, passwordError } from "@/lib/password";
import { Button } from "./ui/button";

type Values = {
  currentPassword: string;
  password: string;
  confirmation: string;
  nonce: string;
};
export function PasswordForm({
  recovery = false,
  onSuccess,
}: {
  recovery?: boolean;
  onSuccess?: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(passwordFormSchema(recovery)),
    defaultValues: {
      currentPassword: "",
      password: "",
      confirmation: "",
      nonce: "",
    },
  });
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const submitting = useRef(false);

  const submit = handleSubmit(async (values) => {
    if (submitting.current) return;
    submitting.current = true;
    setError("");
    setSuccess(false);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await auth().auth.getSession();
      if (sessionError) throw sessionError;
      if (!session)
        throw new Error(
          "Tu sesión venció. Inicia sesión o solicita otro enlace de recuperación.",
        );
      const { error: changeError } = await auth().auth.updateUser({
        password: values.password,
        ...(!recovery ? { current_password: values.currentPassword } : {}),
        ...(values.nonce ? { nonce: values.nonce } : {}),
      });
      if (changeError) {
        if (
          changeError.code === "reauthentication_needed" ||
          changeError.code === "reauthentication_not_valid"
        )
          setNeedsCode(true);
        if (changeError.code === "reauthentication_not_valid")
          setCodeSent(false);
        throw changeError;
      }
      reset();
      setShow(false);
      setNeedsCode(false);
      setCodeSent(false);
      setSuccess(true);
      onSuccess?.();
    } catch (e) {
      setError(passwordError(e as Error & { code?: string }));
    } finally {
      submitting.current = false;
    }
  });

  return (
    <form
      className="settings-form"
      onSubmit={submit}
      onChange={() => {
        setSuccess(false);
        setError("");
      }}
      noValidate
      aria-label={recovery ? "Restablecer contraseña" : "Cambiar contraseña"}
    >
      <p className="detail">
        {recovery
          ? "El enlace verificó tu acceso. Crea y confirma tu nueva contraseña."
          : "Actualiza la contraseña de tu cuenta. Necesitarás tu clave actual."}{" "}
        Usa al menos 12 caracteres.
      </p>
      <fieldset
        disabled={isSubmitting}
        style={{
          border: 0,
          padding: 0,
          margin: 0,
          display: "grid",
          gap: 18,
          minWidth: 0,
        }}
      >
        {!recovery && (
          <label htmlFor="current-password">
            Contraseña actual
            <input
              id="current-password"
              aria-label="Contraseña actual"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              {...register("currentPassword")}
              aria-invalid={!!errors.currentPassword}
              aria-describedby={
                errors.currentPassword ? "current-password-error" : undefined
              }
            />
            {errors.currentPassword && (
              <span
                id="current-password-error"
                className="error-text"
                role="alert"
              >
                {errors.currentPassword.message}
              </span>
            )}
          </label>
        )}
        <label htmlFor="new-password">
          Nueva contraseña
          <input
            id="new-password"
            aria-label="Nueva contraseña"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            {...register("password")}
            aria-invalid={!!errors.password}
            aria-describedby={
              errors.password ? "new-password-error" : "password-help"
            }
          />
          {errors.password && (
            <span id="new-password-error" className="error-text" role="alert">
              {errors.password.message}
            </span>
          )}
        </label>
        <small id="password-help">
          Puedes usar una frase larga. Máximo 72 bytes; algunos caracteres
          ocupan más de un byte.
        </small>
        <label htmlFor="confirm-password">
          Confirmar nueva contraseña
          <input
            id="confirm-password"
            aria-label="Confirmar nueva contraseña"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            {...register("confirmation")}
            aria-invalid={!!errors.confirmation}
            aria-describedby={
              errors.confirmation ? "confirm-password-error" : undefined
            }
          />
          {errors.confirmation && (
            <span
              id="confirm-password-error"
              className="error-text"
              role="alert"
            >
              {errors.confirmation.message}
            </span>
          )}
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          style={{ justifySelf: "start" }}
          aria-pressed={show}
          onClick={() => setShow(!show)}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}{" "}
          {show ? "Ocultar contraseñas" : "Mostrar contraseñas"}
        </Button>
        {needsCode && (
          <>
            <label htmlFor="password-code">
              Código de verificación
              <input
                id="password-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                {...register("nonce")}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={sendingCode || codeSent}
              onClick={async () => {
                setSendingCode(true);
                setError("");
                try {
                  const { error } = await auth().auth.reauthenticate();
                  if (error) throw error;
                  setCodeSent(true);
                } catch (e) {
                  setError(passwordError(e as Error & { code?: string }));
                } finally {
                  setSendingCode(false);
                }
              }}
            >
              {sendingCode
                ? "Enviando…"
                : codeSent
                  ? "Código enviado a tu correo"
                  : "Enviar código de verificación"}
            </Button>
            {codeSent && (
              <p className="detail" role="status">
                Revisa el correo vinculado a tu cuenta e ingresa el código para
                continuar.
              </p>
            )}
          </>
        )}
      </fieldset>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="positive">
          Contraseña actualizada correctamente. Úsala la próxima vez que inicies
          sesión.
        </p>
      )}
      <Button
        type="submit"
        disabled={isSubmitting}
        style={{ justifySelf: "start" }}
      >
        <KeyRound size={16} />
        {isSubmitting
          ? "Guardando…"
          : recovery
            ? "Guardar nueva contraseña"
            : "Cambiar contraseña"}
      </Button>
    </form>
  );
}
