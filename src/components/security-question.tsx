"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { newPassword } from "@/lib/password";
import { Button } from "./ui/button";

const answerSchema = z
  .string()
  .trim()
  .min(8, "Usa una respuesta privada de al menos ocho caracteres.")
  .max(200);
const questionSchema = z
  .object({
    question: z.string().trim().min(10).max(180),
    answer: answerSchema,
    answerConfirmation: z.string(),
    proof: z.string().min(1, "Confirma tu identidad para guardar la pregunta."),
  })
  .refine(
    (p) =>
      p.answer.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase() ===
      p.answerConfirmation
        .normalize("NFKC")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase(),
    { path: ["answerConfirmation"], message: "Las respuestas no coinciden." },
  );
async function publicRequest(path: string, body: unknown) {
  const response = await fetch(
    (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1") + path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Error(result.error?.message ?? "No se pudo completar la operación.");
  return result;
}

export function SecurityQuestionSetup({
  username,
  bootstrap = false,
  onSaved,
}: {
  username: string;
  bootstrap?: boolean;
  onSaved?: (question: string) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof questionSchema>>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      question: "¿Cuál es mi frase de recuperación personal?",
      answer: "",
      answerConfirmation: "",
      proof: "",
    },
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="settings-form"
      aria-label="Configurar pregunta de seguridad"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        setError("");
        setSaved(false);
        try {
          const payload = {
            username,
            question: values.question,
            answer: values.answer,
            answerConfirmation: values.answerConfirmation,
            ...(bootstrap
              ? { code: values.proof.trim() }
              : { currentPassword: values.proof }),
          };
          if (bootstrap)
            await publicRequest("/auth/security-question/setup", payload);
          else await api("/auth/security-question/setup", "POST", payload);
          reset({ ...values, answer: "", answerConfirmation: "", proof: "" });
          setSaved(true);
          onSaved?.(values.question);
        } catch (e) {
          setError((e as Error).message);
        }
      })}
    >
      <p className="detail">
        {bootstrap
          ? "Confirma tu identidad una sola vez con el código de recuperación del administrador. Luego podrás usar tu pregunta sin códigos ni correo."
          : "Configura o cambia tu pregunta y respuesta privadas para recuperar tu clave sin correo."}
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
        <label>
          Pregunta de seguridad
          <input
            {...register("question")}
            aria-label="Pregunta de seguridad"
            maxLength={180}
          />
          {errors.question && (
            <span role="alert" className="error-text">
              Escribe una pregunta de 10 a 180 caracteres.
            </span>
          )}
        </label>
        <label>
          Respuesta privada
          <input
            {...register("answer")}
            type="password"
            autoComplete="off"
            aria-label="Respuesta privada"
          />
          {errors.answer && (
            <span role="alert" className="error-text">
              {errors.answer.message}
            </span>
          )}
        </label>
        <label>
          Confirmar respuesta
          <input
            {...register("answerConfirmation")}
            type="password"
            autoComplete="off"
            aria-label="Confirmar respuesta"
          />
          {errors.answerConfirmation && (
            <span role="alert" className="error-text">
              {errors.answerConfirmation.message}
            </span>
          )}
        </label>
        <small>
          Usa una frase que solo tú conozcas, de al menos ocho caracteres. Se
          ignoran mayúsculas y espacios repetidos.
        </small>
        <label>
          {bootstrap ? "Código de recuperación inicial" : "Contraseña actual"}
          <input
            {...register("proof")}
            type="password"
            autoComplete={bootstrap ? "off" : "current-password"}
            aria-label={
              bootstrap ? "Código de recuperación inicial" : "Contraseña actual"
            }
          />
          {errors.proof && (
            <span role="alert" className="error-text">
              {errors.proof.message}
            </span>
          )}
        </label>
      </fieldset>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="positive">
          Pregunta de seguridad guardada correctamente.
        </p>
      )}
      <Button disabled={isSubmitting} style={{ justifySelf: "start" }}>
        {isSubmitting ? "Guardando…" : "Guardar pregunta de seguridad"}
      </Button>
    </form>
  );
}

const resetSchema = z
  .object({
    answer: answerSchema,
    password: newPassword,
    confirmation: z.string(),
  })
  .refine((p) => p.password === p.confirmation, {
    path: ["confirmation"],
    message: "Las contraseñas no coinciden.",
  });
export function SecurityQuestionRecovery({
  initialUsername = "",
  onBack,
  onCode,
  onSuccess,
}: {
  initialUsername?: string;
  onBack: () => void;
  onCode: () => void;
  onSuccess: (username: string) => void;
}) {
  const [username, setUsername] = useState(initialUsername);
  const [question, setQuestion] = useState<string | null | undefined>();
  const [setup, setSetup] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { answer: "", password: "", confirmation: "" },
  });
  return (
    <>
      {question === undefined ? (
        <form
          aria-label="Consultar pregunta de seguridad"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setLookupBusy(true);
            try {
              const result = await publicRequest(
                "/auth/security-question/lookup",
                { username },
              );
              setQuestion(result.question);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setLookupBusy(false);
            }
          }}
        >
          <label>
            Usuario
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="ealva o mramirez"
            />
          </label>
          <Button disabled={lookupBusy}>
            {lookupBusy ? "Consultando…" : "Ver mi pregunta"}
          </Button>
        </form>
      ) : (
        <>
          <p className="detail" style={{ marginBottom: 18 }}>
            Usuario: <strong>{username}</strong>
          </p>
          {setup ? (
            <SecurityQuestionSetup
              username={username}
              bootstrap
              onSaved={(value) => {
                setSetup(false);
                setQuestion(value);
                setError("");
              }}
            />
          ) : question ? (
            <form
              aria-label="Recuperar con pregunta de seguridad"
              noValidate
              onSubmit={handleSubmit(async (values) => {
                setError("");
                try {
                  await publicRequest("/auth/security-question/reset", {
                    username,
                    ...values,
                  });
                  reset();
                  onSuccess(username);
                } catch (e) {
                  setError((e as Error).message);
                }
              })}
            >
              <div className="callout">
                <h3>{question}</h3>
              </div>
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
                  Tu respuesta
                  <input
                    {...register("answer")}
                    type="password"
                    autoComplete="off"
                    aria-label="Tu respuesta"
                  />
                  {errors.answer && (
                    <span role="alert" className="error-text">
                      {errors.answer.message}
                    </span>
                  )}
                </label>
                <label>
                  Nueva contraseña
                  <input
                    {...register("password")}
                    type="password"
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
                    type="password"
                    autoComplete="new-password"
                    aria-label="Confirmar nueva contraseña"
                  />
                  {errors.confirmation && (
                    <span role="alert" className="error-text">
                      {errors.confirmation.message}
                    </span>
                  )}
                </label>
              </fieldset>
              <Button disabled={isSubmitting}>
                {isSubmitting ? "Actualizando…" : "Guardar nueva contraseña"}
              </Button>
            </form>
          ) : (
            <div className="config-box">
              <h3>Aún no tienes una pregunta configurada</h3>
              <p className="detail" style={{ marginTop: 10 }}>
                Configúrala una vez desde tu cuenta o con un código de
                recuperación inicial.
              </p>
              <Button
                variant="outline"
                style={{ marginTop: 15 }}
                onClick={() => setSetup(true)}
              >
                Configurar por primera vez
              </Button>
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="error-text" style={{ marginTop: 15 }}>
          {error}
        </p>
      )}
      <div className="auth-links">
        <button onClick={onBack}>Volver a iniciar sesión</button>
        <button onClick={onCode}>Usar código de recuperación</button>
      </div>
      {question !== undefined && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQuestion(undefined);
            setSetup(false);
            setError("");
            reset();
          }}
        >
          Cambiar usuario
        </Button>
      )}
    </>
  );
}
