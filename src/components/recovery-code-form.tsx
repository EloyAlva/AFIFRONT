"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { newPassword } from "@/lib/password";
import { publicRequest } from "@/lib/backend";
import { Button } from "./ui/button";

const schema = z
  .object({
    username: z.string().trim().min(1, "Ingresa tu usuario."),
    code: z
      .string()
      .trim()
      .regex(
        /^[A-Za-z0-9_-]{43}$/,
        "Pega el código completo entregado por el administrador.",
      ),
    password: newPassword,
    confirmation: z.string(),
  })
  .refine((v) => v.password === v.confirmation, {
    path: ["confirmation"],
    message: "Las contraseñas no coinciden.",
  });
type Values = z.infer<typeof schema>;
export function RecoveryCodeForm({
  initialUsername = "",
  onSuccess,
  onBack,
  onEmail,
}: {
  initialUsername?: string;
  onSuccess: (username: string) => void;
  onBack: () => void;
  onEmail: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: initialUsername,
      code: "",
      password: "",
      confirmation: "",
    },
  });
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  return (
    <>
      <form
        aria-label="Recuperar con código"
        noValidate
        onSubmit={handleSubmit(async (values) => {
          setError("");
          try {
            await publicRequest("/auth/password-recovery", "POST", values);
            reset();
            setShow(false);
            onSuccess(values.username);
          } catch (e) {
            setError((e as Error).message);
          }
        })}
      >
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
          <label>
            Usuario
            <input
              {...register("username")}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="ealva o mramirez"
              aria-label="Usuario"
            />
            {errors.username && (
              <span role="alert" className="error-text">
                {errors.username.message}
              </span>
            )}
          </label>
          <label>
            Código de recuperación
            <input
              {...register("code")}
              type={show ? "text" : "password"}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-label="Código de recuperación"
            />
            {errors.code && (
              <span role="alert" className="error-text">
                {errors.code.message}
              </span>
            )}
          </label>
          <label>
            Nueva contraseña
            <input
              {...register("password")}
              type={show ? "text" : "password"}
              autoComplete="new-password"
              aria-label="Nueva contraseña"
            />
            {errors.password && (
              <span role="alert" className="error-text">
                {errors.password.message}
              </span>
            )}
          </label>
          <label>
            Confirmar nueva contraseña
            <input
              {...register("confirmation")}
              type={show ? "text" : "password"}
              autoComplete="new-password"
              aria-label="Confirmar nueva contraseña"
            />
            {errors.confirmation && (
              <span role="alert" className="error-text">
                {errors.confirmation.message}
              </span>
            )}
          </label>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            aria-pressed={show}
            onClick={() => setShow(!show)}
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}{" "}
            {show ? "Ocultar datos" : "Mostrar datos"}
          </Button>
        </fieldset>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <Button disabled={isSubmitting}>
          {isSubmitting ? "Cambiando contraseña…" : "Guardar nueva contraseña"}
        </Button>
      </form>
      <p className="detail" style={{ marginTop: 18 }}>
        El código es personal, vence en 30 minutos y sirve una sola vez. Si no
        tienes uno, solicítalo al administrador.
      </p>
      <div className="auth-links">
        <button onClick={onBack}>Volver a iniciar sesión</button>
        <button onClick={onEmail}>Recuperar por correo</button>
      </div>
    </>
  );
}
