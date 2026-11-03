"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import {
  ArrowRight,
  Check,
  Pencil,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { api, formatMoney } from "@/lib/api";
import {
  accountChoices,
  answerStep,
  blankDraft,
  categoryChoices,
  draftFromExtraction,
  matchChoice,
  nextStep,
  normalizeChoice,
  parseAmount,
  promptFor,
  transactionPayload,
  type AssistantContext,
  type AssistantDraft,
} from "@/lib/assistant-flow";
import { Button } from "./ui/button";
import type { Row } from "./resource-form";

type Message = { role: "assistant" | "user"; text: string };
type Prepared = {
  fingerprint: string;
  payload: ReturnType<typeof transactionPayload>;
  id?: string;
  key: string;
};
export function FinancialAssistant({
  data,
  userId,
  loading,
  onRefresh,
  onManual,
  onAccounts,
  onCategories,
}: {
  data: Record<string, Row[]>;
  userId: string;
  loading: boolean;
  onRefresh: () => void;
  onManual: (initial?: Row) => void;
  onAccounts: () => void;
  onCategories: () => void;
}) {
  const context: AssistantContext = useMemo(
    () => ({
      accounts: (data.accounts ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        active: a.active,
        type: a.type,
      })),
      categories: (data.categories ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
      })),
      currency: data.profile?.[0]?.currency ?? "PEN",
      timezone: data.profile?.[0]?.timezone ?? "America/Lima",
    }),
    [data.accounts, data.categories, data.profile],
  );
  const [history, setHistory] = useState<Message[]>([
    {
      role: "assistant",
      text: "Hola, soy AFI. Te ayudo a registrar un ingreso o un gasto. Puedes contarme qué pasó, por ejemplo: «Gasté 25 soles en almuerzo». Te preguntaré por lo que falte.",
    },
  ]);
  const [draft, setDraft] = useState<AssistantDraft | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState(0);
  const prepared = useRef<Prepared | null>(null);
  const sending = useRef(false);
  const restoreStarted = useRef(false);
  const composer = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const storageKey = "afi.pending-ai." + userId;
  const step = draft ? nextStep(draft, context) : null;
  const options =
    step === "account" && draft
      ? accountChoices(draft, context)
      : step === "category" && draft
        ? categoryChoices(draft, context)
        : [];
  const money = (d: AssistantDraft) => formatMoney(d.amount ?? 0, d.currency);
  const add = (messages: Message[]) =>
    setHistory((previous) => [...previous, ...messages]);
  const clearPending = () => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {}
  };
  const finish = (saved: AssistantDraft) => {
    clearPending();
    setUncertain(false);
    setDraft(saved);
    setDone(true);
    setEditing(false);
    setError("");
    add([
      {
        role: "assistant",
        text: `Movimiento registrado correctamente: ${saved.type === "income" ? "ingreso" : "gasto"} de ${money(saved)} por «${saved.description}». ¿Registramos otro?`,
      },
    ]);
    onRefresh();
  };

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [history, step, busy, done]);
  useEffect(() => {
    if (restoreStarted.current || loading || !data.profile?.[0]) return;
    restoreStarted.current = true;
    let pending: { id: string; key: string };
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      pending = JSON.parse(raw);
      if (
        !/^[0-9a-f-]{36}$/i.test(pending.id) ||
        !/^[0-9a-f-]{36}$/i.test(pending.key)
      ) {
        clearPending();
        return;
      }
    } catch {
      return;
    }
    setBusy(true);
    setUncertain(true);
    api("/ai/drafts/" + pending.id)
      .then((result) => {
        const p = result.payload;
        const restored: AssistantDraft = {
          type: p.type,
          amount: p.amount,
          currency: p.currency,
          description: p.description,
          account_id: p.source_account_id ?? p.destination_account_id,
          category_id: p.category_id,
          date: DateTime.fromISO(p.occurred_at)
            .setZone(context.timezone)
            .toISODate()!,
          dateConfirmed: true,
        };
        prepared.current = {
          fingerprint: JSON.stringify(restored),
          payload: p,
          id: pending.id,
          key: pending.key,
        };
        setDraft(restored);
        if (result.transaction_id) finish(restored);
        else
          add([
            {
              role: "assistant",
              text: "Recuperé el registro que habías confirmado. Reintenta para comprobar su resultado sin duplicarlo.",
            },
          ]);
      })
      .catch((e) => {
        if ([400, 404].includes((e as { status?: number }).status ?? 0)) {
          clearPending();
          setUncertain(false);
        }
        setError((e as Error).message);
      })
      .finally(() => setBusy(false));
  }, [userId, loading, data.profile, restoreVersion]);

  const start = (type: "income" | "expense") => {
    if (busy || uncertain) return;
    setDone(false);
    setEditing(false);
    setError("");
    prepared.current = null;
    const next = { ...blankDraft(context), type };
    setDraft(next);
    add([
      {
        role: "user",
        text:
          type === "income"
            ? "Quiero registrar un ingreso"
            : "Quiero registrar un gasto",
      },
    ]);
    composer.current?.focus();
  };
  const accept = (next: AssistantDraft, text: string) => {
    if (!draft) return;
    add([
      { role: "assistant", text: promptFor(draft, context) },
      { role: "user", text },
    ]);
    setDraft(next);
    setError("");
    setEditing(false);
    prepared.current = null;
    composer.current?.focus();
  };
  const payWithCredit = () => {
    if (!draft || busy || uncertain) return;
    onManual({
      type: "expense",
      funding_source: "credit_card",
      amount: draft.amount,
      currency: draft.currency,
      description: draft.description,
      category_id: draft.category_id,
      occurred_at: draft.date + "T12:00",
    });
    setDraft(null);
    setError("");
    prepared.current = null;
    add([
      {
        role: "assistant",
        text: "Completa la tarjeta y las cuotas en el formulario y confirma la compra. El gasto se cargará al crédito de la tarjeta.",
      },
    ]);
  };
  const confirm = async () => {
    if (sending.current || !draft || done) return;
    if (nextStep(draft, context) !== "confirm" && !prepared.current?.id) {
      setError("Completa los datos antes de confirmar.");
      return;
    }
    sending.current = true;
    setBusy(true);
    setError("");
    setEditing(false);
    try {
      const fingerprint = JSON.stringify(draft);
      if (!prepared.current || prepared.current.fingerprint !== fingerprint)
        prepared.current = {
          fingerprint,
          payload: transactionPayload(draft, context),
          key: crypto.randomUUID(),
        };
      const ready = prepared.current;
      if (!ready.id) {
        const result = await api("/ai/drafts", "POST", ready.payload);
        ready.id = result.id;
      }
      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({ id: ready.id, key: ready.key }),
        );
      } catch {}
      setUncertain(true);
      await api(
        "/ai/drafts/" + ready.id + "/confirm",
        "POST",
        { confirmed: true },
        ready.key,
      );
      finish(draft);
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status && status < 500) {
        clearPending();
        setUncertain(false);
        prepared.current = null;
      }
      setError(
        (e as Error).message +
          (status && status < 500
            ? ""
            : " Reintenta para verificar el resultado; conservaré la misma solicitud para evitar duplicados."),
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  const cancel = () => {
    if (busy || uncertain) return;
    setDraft(null);
    setDone(false);
    setEditing(false);
    prepared.current = null;
    setError("");
    add([
      {
        role: "assistant",
        text: "Borrador cancelado. No registré ningún movimiento. Puedes contarme otro ingreso o gasto.",
      },
    ]);
  };
  const send = async () => {
    const text = input.trim();
    if (!text || sending.current || busy) return;
    setInput("");
    setError("");
    const normalized = normalizeChoice(text);
    if (draft && !done) {
      if (uncertain) {
        setError(
          "Primero reintenta el registro pendiente para verificar su resultado.",
        );
        return;
      }
      if (["cancelar", "cancela"].includes(normalized)) {
        cancel();
        return;
      }
      if (step === "confirm") {
        if (
          [
            "si",
            "si confirmo",
            "confirmo",
            "confirmar",
            "guardar",
            "si registrar",
          ].includes(normalized)
        ) {
          add([{ role: "user", text }]);
          await confirm();
          return;
        }
        if (normalized === "no") {
          setEditing(true);
          add([{ role: "user", text }]);
          return;
        }
        const change = normalized.match(
          /^(monto|importe|fueron|son|cuenta|desde|categoria|fecha|descripcion)\s*:?\s+(.+)$/,
        );
        if (change) {
          const next = { ...draft };
          const value = text
            .slice(text.indexOf(" ") + 1)
            .replace(/^:\s*/, "")
            .trim();
          let valid = true;
          if (["monto", "importe", "fueron", "son"].includes(change[1])) {
            next.amount = parseAmount(value);
            valid = next.amount !== null;
          } else if (["cuenta", "desde"].includes(change[1])) {
            next.account_id = matchChoice(value, accountChoices(next, context));
            valid = !!next.account_id;
          } else if (change[1] === "categoria") {
            next.category_id = matchChoice(
              value,
              categoryChoices(next, context),
            );
            valid = !!next.category_id;
          } else if (change[1] === "descripcion") {
            next.description = value;
            valid = value.length > 0 && value.length <= 500;
          } else {
            const dated = answerStep(
              { ...next, dateConfirmed: false },
              value,
              context,
            );
            if (dated) next.date = dated.date;
            else valid = false;
          }
          if (valid) {
            accept(next, text);
            return;
          }
        }
        setError(
          "Para guardar, escribe «sí» o pulsa Confirmar y registrar. También puedes editar los datos o cancelar.",
        );
        return;
      }
      const next = answerStep(draft, text, context);
      if (!next) {
        add([{ role: "user", text }]);
        setError(
          step === "account" || step === "category"
            ? "Elige una opción de la lista para evitar confusiones."
            : step === "date"
              ? "Escribe Hoy, Ayer, DD/MM/AAAA o AAAA-MM-DD."
              : "No entendí ese dato. " + promptFor(draft, context),
        );
        return;
      }
      accept(next, text);
      return;
    }
    if (["gasto", "registrar gasto", "un gasto"].includes(normalized)) {
      start("expense");
      return;
    }
    if (["ingreso", "registrar ingreso", "un ingreso"].includes(normalized)) {
      start("income");
      return;
    }
    sending.current = true;
    setBusy(true);
    setDone(false);
    setDraft(null);
    prepared.current = null;
    add([{ role: "user", text }]);
    try {
      const result = await api(
        "/ai/interpret",
        "POST",
        { message: text },
        crypto.randomUUID(),
      );
      prepared.current = null;
      setDraft(draftFromExtraction(result.extracted, context));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="assistant-home">
      <div className="page-heading">
        <div>
          <div className="assistant-kicker">
            <Sparkles size={14} /> TU ASISTENTE FINANCIERO
          </div>
          <h1>Hablemos de tus finanzas</h1>
          <p>
            Cuéntame tu ingreso o gasto. Te guiaré paso a paso para registrarlo.
          </p>
        </div>
        <Button variant="outline" onClick={() => onManual()}>
          <Wallet size={15} />
          Registro manual
        </Button>
      </div>
      <section
        className="card assistant-conversation"
        aria-label="Conversación con AFI"
      >
        <div
          className="assistant-chat"
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {history.map((message, i) => (
            <div key={i} className={"assistant-turn " + message.role}>
              {message.role === "assistant" && (
                <div className="assistant-avatar">
                  <Sparkles size={16} />
                </div>
              )}
              <div className="assistant-bubble">{message.text}</div>
            </div>
          ))}
          {draft && !done && !editing && (
            <div className="assistant-turn assistant">
              <div className="assistant-avatar">
                <Sparkles size={16} />
              </div>
              <div className="assistant-bubble">
                {promptFor(draft, context)}
              </div>
            </div>
          )}
          {busy && (
            <div className="assistant-turn assistant">
              <div className="assistant-avatar">
                <Sparkles size={16} />
              </div>
              <div className="assistant-bubble" role="status">
                {uncertain ? "Comprobando el registro…" : "Un momento…"}
              </div>
            </div>
          )}
          <div ref={end} />
        </div>
        <div className="assistant-actions">
          {(!draft || done) && (
            <div className="assistant-choices">
              <Button
                variant="outline"
                disabled={busy || loading || uncertain}
                onClick={() => start("expense")}
              >
                Registrar gasto
              </Button>
              <Button
                variant="outline"
                disabled={busy || loading || uncertain}
                onClick={() => start("income")}
              >
                Registrar ingreso
              </Button>
            </div>
          )}
          {draft && !done && !busy && !editing && (
            <>
              {step === "type" && (
                <div className="assistant-choices">
                  <Button
                    variant="outline"
                    onClick={() =>
                      accept({ ...draft, type: "expense" }, "Gasto")
                    }
                  >
                    Gasto
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      accept({ ...draft, type: "income" }, "Ingreso")
                    }
                  >
                    Ingreso
                  </Button>
                </div>
              )}
              {options.length > 0 && (
                <div className="assistant-choices">
                  {options.map((option) => (
                    <Button
                      variant="outline"
                      key={option.id}
                      onClick={() =>
                        accept(
                          {
                            ...draft,
                            ...(step === "account"
                              ? { account_id: option.id }
                              : { category_id: option.id }),
                          },
                          option.name,
                        )
                      }
                    >
                      {option.name}
                    </Button>
                  ))}
                </div>
              )}
              {step === "account" && (
                <div className="row" style={{ flexWrap: "wrap" }}>
                  {draft.type === "expense" && (
                    <Button variant="outline" onClick={payWithCredit}>
                      Pagar con tarjeta de crédito
                    </Button>
                  )}
                  {!options.length && (
                    <Button variant="outline" onClick={onAccounts}>
                      Ir a Mis cuentas
                      <ArrowRight size={14} />
                    </Button>
                  )}
                  <label className="assistant-currency">
                    Moneda
                    <select
                      aria-label="Moneda del movimiento"
                      value={draft.currency}
                      onChange={(e) =>
                        accept(
                          {
                            ...draft,
                            currency: e.target.value,
                            account_id: null,
                          },
                          "Usaré " + e.target.value,
                        )
                      }
                    >
                      {Array.from(
                        new Set([
                          draft.currency,
                          context.currency,
                          ...context.accounts
                            .map((a) => a.currency)
                            .filter((v): v is string => !!v),
                          "PEN",
                          "USD",
                          "EUR",
                        ]),
                      ).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              {step === "category" && !options.length && (
                <Button variant="outline" onClick={onCategories}>
                  Crear categoría manualmente
                  <ArrowRight size={14} />
                </Button>
              )}
              {step === "date" && (
                <div className="assistant-choices">
                  {[
                    "Hoy",
                    "Ayer",
                    DateTime.fromISO(draft.date).toFormat("dd/MM/yyyy"),
                  ]
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .map((value) => (
                      <Button
                        variant="outline"
                        key={value}
                        onClick={() => {
                          const next = answerStep(draft, value, context);
                          if (next) accept(next, value);
                        }}
                      >
                        {value}
                      </Button>
                    ))}
                </div>
              )}
            </>
          )}
          {draft && !done && (step === "confirm" || uncertain || editing) && (
            <div className="assistant-summary">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h2>Resumen para confirmar</h2>
                <span className="badge">
                  {draft.type === "income" ? "Ingreso" : "Gasto"}
                </span>
              </div>
              {editing ? (
                <form
                  className="form-grid"
                  style={{ marginTop: 18 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    setEditing(false);
                    setError("");
                    prepared.current = null;
                  }}
                >
                  <label>
                    Tipo
                    <select
                      aria-label="Editar tipo"
                      value={draft.type ?? "expense"}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          type: e.target.value as "income" | "expense",
                          category_id: null,
                        })
                      }
                    >
                      <option value="expense">Gasto</option>
                      <option value="income">Ingreso</option>
                    </select>
                  </label>
                  <label>
                    Monto
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      aria-label="Editar monto"
                      value={draft.amount ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          amount: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                    />
                  </label>
                  <label>
                    Moneda
                    <select
                      value={draft.currency}
                      aria-label="Editar moneda"
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          currency: e.target.value,
                          account_id: null,
                        })
                      }
                    >
                      {Array.from(
                        new Set([
                          draft.currency,
                          ...context.accounts
                            .map((a) => a.currency)
                            .filter(Boolean),
                          "PEN",
                          "USD",
                          "EUR",
                        ]),
                      ).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Cuenta
                    <select
                      aria-label="Editar cuenta"
                      value={draft.account_id ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          account_id: e.target.value || null,
                        })
                      }
                    >
                      <option value="">Seleccionar</option>
                      {accountChoices(draft, context).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Categoría
                    <select
                      aria-label="Editar categoría"
                      value={draft.category_id ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          category_id: e.target.value || null,
                        })
                      }
                    >
                      <option value="">Seleccionar</option>
                      {categoryChoices(draft, context).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Fecha
                    <input
                      aria-label="Editar fecha"
                      type="date"
                      required
                      value={draft.date}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          date: e.target.value,
                          dateConfirmed: true,
                        })
                      }
                    />
                  </label>
                  <label className="full">
                    Descripción
                    <input
                      aria-label="Editar descripción"
                      maxLength={500}
                      required
                      value={draft.description}
                      onChange={(e) =>
                        setDraft({ ...draft, description: e.target.value })
                      }
                    />
                  </label>
                  <Button type="submit">Aplicar cambios</Button>
                </form>
              ) : (
                <>
                  <dl className="assistant-details">
                    <div>
                      <dt>Monto</dt>
                      <dd>{money(draft)}</dd>
                    </div>
                    <div>
                      <dt>Cuenta</dt>
                      <dd>
                        {context.accounts.find((a) => a.id === draft.account_id)
                          ?.name ?? "Cuenta seleccionada"}
                      </dd>
                    </div>
                    <div>
                      <dt>Categoría</dt>
                      <dd>
                        {context.categories.find(
                          (c) => c.id === draft.category_id,
                        )?.name ?? "Sin categoría"}
                      </dd>
                    </div>
                    <div>
                      <dt>Fecha</dt>
                      <dd>
                        {DateTime.fromISO(draft.date).toFormat("dd/MM/yyyy")}
                      </dd>
                    </div>
                    <div className="full">
                      <dt>Descripción</dt>
                      <dd>{draft.description}</dd>
                    </div>
                  </dl>
                  <div className="assistant-choices">
                    <Button disabled={busy} onClick={() => void confirm()}>
                      <Check size={16} />
                      {uncertain
                        ? "Reintentar registro"
                        : "Confirmar y registrar"}
                    </Button>
                    {draft.type === "expense" && (
                      <Button
                        variant="outline"
                        disabled={busy || uncertain}
                        onClick={payWithCredit}
                      >
                        Pagar con tarjeta de crédito
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      disabled={busy || uncertain}
                      onClick={() => setEditing(true)}
                    >
                      <Pencil size={14} />
                      Editar datos
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy || uncertain}
                      onClick={cancel}
                    >
                      <X size={14} />
                      Cancelar
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="alert-error"
              style={{ marginTop: 16, marginBottom: 0 }}
            >
              {error}
            </p>
          )}
          {uncertain && !draft && !busy && (
            <Button
              variant="outline"
              onClick={() => {
                restoreStarted.current = false;
                setRestoreVersion((v) => v + 1);
              }}
            >
              Volver a comprobar el registro pendiente
            </Button>
          )}
        </div>
        <form
          className="assistant-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            ref={composer}
            aria-label="Mensaje para AFI"
            placeholder={
              draft && !done
                ? step === "confirm"
                  ? "Escribe «sí» para confirmar o edita los datos…"
                  : "Responde aquí o elige una opción…"
                : "Ej.: Gasté 25 soles en almuerzo…"
            }
            maxLength={3000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy || loading || editing || uncertain}
          />
          <Button
            type="submit"
            disabled={!input.trim() || busy || loading || editing || uncertain}
            aria-label="Enviar mensaje"
          >
            <Send size={17} />
          </Button>
        </form>
      </section>
      <div className="ai-note">
        <ShieldCheck size={16} />
        <span>
          Solo registraré el movimiento cuando lo confirmes. Las cuentas y
          categorías se configuran manualmente.
        </span>
      </div>
    </div>
  );
}
