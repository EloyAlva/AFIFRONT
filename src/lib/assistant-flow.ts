import { DateTime } from "luxon";

export type AssistantDraft = {
  type: "income" | "expense" | null;
  amount: number | null;
  currency: string;
  description: string;
  account_id: string | null;
  category_id: string | null;
  date: string;
  dateConfirmed: boolean;
};
export type AssistantChoice = {
  id: string;
  name: string;
  currency?: string;
  type?: string;
  active?: boolean;
};
export type AssistantStep =
  | "type"
  | "amount"
  | "description"
  | "account"
  | "category"
  | "date"
  | "confirm";
export type AssistantContext = {
  accounts: AssistantChoice[];
  categories: AssistantChoice[];
  timezone: string;
  currency: string;
};

export function today(zone: string) {
  return DateTime.now().setZone(zone).toISODate()!;
}
export function blankDraft(context: AssistantContext): AssistantDraft {
  return {
    type: null,
    amount: null,
    currency: context.currency,
    description: "",
    account_id: null,
    category_id: null,
    date: today(context.timezone),
    dateConfirmed: false,
  };
}
export function draftFromExtraction(
  value: Record<string, unknown>,
  context: AssistantContext,
): AssistantDraft {
  const draft = blankDraft(context);
  if (value.type === "income" || value.type === "expense")
    draft.type = value.type;
  if (typeof value.amount === "number" && validAmount(value.amount))
    draft.amount = value.amount;
  if (typeof value.currency === "string" && /^[A-Z]{3}$/.test(value.currency))
    draft.currency = value.currency;
  if (typeof value.description === "string")
    draft.description = value.description.slice(0, 500).trim();
  if (typeof value.date === "string" && DateTime.fromISO(value.date).isValid)
    draft.date = value.date;
  if (
    context.accounts.some(
      (a) =>
        a.id === value.account_id &&
        a.active !== false &&
        a.currency === draft.currency,
    )
  )
    draft.account_id = String(value.account_id);
  if (
    context.categories.some(
      (c) => c.id === value.category_id && c.type === draft.type,
    )
  )
    draft.category_id = String(value.category_id);
  return draft;
}
export function validAmount(value: number) {
  return (
    Number.isFinite(value) &&
    value > 0 &&
    value <= 999999999999 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.001
  );
}
export function parseAmount(text: string): number | null {
  const match = text
    .trim()
    .match(
      /^(?:(?:s\/\.?|pen|usd|eur|\$)\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:soles?|d[oó]lares?|euros?|pen|usd|eur)?$/i,
    );
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  return validAmount(amount) ? amount : null;
}
export function normalizeChoice(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
export function matchChoice(
  text: string,
  choices: AssistantChoice[],
): string | null {
  const normalized = normalizeChoice(text).replace(
    /^(?:desde la cuenta|desde|con la cuenta|con|en la categoria|categoria)\s+/,
    "",
  );
  const matches = choices.filter((c) => normalizeChoice(c.name) === normalized);
  return matches.length === 1 ? matches[0].id : null;
}
export function accountChoices(
  draft: AssistantDraft,
  context: AssistantContext,
) {
  return context.accounts.filter(
    (a) => a.active !== false && a.currency === draft.currency,
  );
}
export function categoryChoices(
  draft: AssistantDraft,
  context: AssistantContext,
) {
  return context.categories.filter((c) => c.type === draft.type);
}
export function nextStep(
  draft: AssistantDraft,
  context: AssistantContext,
): AssistantStep {
  if (!draft.type) return "type";
  if (draft.amount === null || !validAmount(draft.amount)) return "amount";
  if (!draft.description.trim()) return "description";
  if (!accountChoices(draft, context).some((a) => a.id === draft.account_id))
    return "account";
  if (!categoryChoices(draft, context).some((c) => c.id === draft.category_id))
    return "category";
  if (!draft.dateConfirmed || !DateTime.fromISO(draft.date).isValid)
    return "date";
  return "confirm";
}
export function promptFor(
  draft: AssistantDraft,
  context: AssistantContext,
): string {
  switch (nextStep(draft, context)) {
    case "type":
      return "¿Quieres registrar un gasto o un ingreso?";
    case "amount":
      return `¿Cuál fue el monto en ${draft.currency}? Escribe el importe, por ejemplo 25 o 25,50.`;
    case "description":
      return draft.type === "income"
        ? "¿De dónde vino ese ingreso? Cuéntame una breve descripción."
        : "¿En qué fue el gasto? Cuéntame una breve descripción.";
    case "account":
      return accountChoices(draft, context).length
        ? draft.type === "income"
          ? "¿En qué cuenta recibiste el dinero?"
          : "¿Desde qué cuenta pagaste?"
        : `No tienes una cuenta activa en ${draft.currency}. Puedes crearla manualmente en Mis cuentas o elegir otra moneda.`;
    case "category":
      return categoryChoices(draft, context).length
        ? "¿Qué categoría quieres usar? Elige una de las que ya tienes."
        : "No tienes categorías para este tipo de movimiento. Crea una manualmente para continuar.";
    case "date":
      return `¿Cuándo fue? La fecha propuesta es ${DateTime.fromISO(draft.date).toFormat("dd/MM/yyyy")}. Puedes elegir Hoy, Ayer o escribir otra fecha.`;
    case "confirm":
      return "Ya tengo los datos. Revisa el resumen: ¿confirmas que registre este movimiento?";
  }
}
export function answerStep(
  draft: AssistantDraft,
  text: string,
  context: AssistantContext,
): AssistantDraft | null {
  const copy = { ...draft };
  const step = nextStep(copy, context);
  const normalized = normalizeChoice(text);
  if (step === "type") {
    if (["ingreso", "un ingreso", "registrar ingreso"].includes(normalized))
      copy.type = "income";
    else if (["gasto", "un gasto", "registrar gasto"].includes(normalized))
      copy.type = "expense";
    else return null;
  } else if (step === "amount") {
    copy.amount = parseAmount(text);
    if (copy.amount === null) return null;
  } else if (step === "description") {
    if (!text.trim() || text.length > 500) return null;
    copy.description = text.trim();
  } else if (step === "account") {
    copy.account_id = matchChoice(text, accountChoices(copy, context));
    if (!copy.account_id) return null;
  } else if (step === "category") {
    copy.category_id = matchChoice(text, categoryChoices(copy, context));
    if (!copy.category_id) return null;
  } else if (step === "date") {
    let date =
      normalized === "hoy"
        ? DateTime.now().setZone(context.timezone)
        : normalized === "ayer"
          ? DateTime.now().setZone(context.timezone).minus({ days: 1 })
          : DateTime.fromISO(text.trim(), { zone: context.timezone });
    if (!date.isValid)
      date = DateTime.fromFormat(text.trim(), "dd/MM/yyyy", {
        zone: context.timezone,
      });
    if (!date.isValid) return null;
    copy.date = date.toISODate()!;
    copy.dateConfirmed = true;
  } else return null;
  return copy;
}
export type AssistantTransaction = {
  type: "income" | "expense";
  amount: number;
  currency: string;
  occurred_at: string;
  category_id: string;
  description: string;
  source_account_id?: string;
  destination_account_id?: string;
};
export function transactionPayload(
  draft: AssistantDraft,
  context: AssistantContext,
): AssistantTransaction {
  if (nextStep(draft, context) !== "confirm")
    throw Error("Completa los datos antes de confirmar.");
  const localNow = DateTime.now().setZone(context.timezone);
  const occurredAt =
    draft.date === localNow.toISODate()
      ? localNow
      : DateTime.fromISO(draft.date, { zone: context.timezone }).set({
          hour: 12,
        });
  return {
    type: draft.type!,
    amount: draft.amount!,
    currency: draft.currency,
    occurred_at: occurredAt.toISO()!,
    category_id: draft.category_id!,
    ...(draft.type === "income"
      ? { destination_account_id: draft.account_id! }
      : { source_account_id: draft.account_id! }),
    description: draft.description,
  };
}
