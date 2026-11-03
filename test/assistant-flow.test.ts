import test from "node:test";
import assert from "node:assert/strict";
import {
  answerStep,
  blankDraft,
  draftFromExtraction,
  nextStep,
  parseAmount,
  matchChoice,
  transactionPayload,
  type AssistantContext,
} from "../src/lib/assistant-flow";
const context: AssistantContext = {
  currency: "PEN",
  timezone: "America/Lima",
  accounts: [
    { id: "a", name: "Yape", currency: "PEN", active: true },
    { id: "b", name: "Dólares", currency: "USD", active: true },
    { id: "closed", name: "Cerrada", currency: "PEN", active: false },
  ],
  categories: [
    { id: "food", name: "Alimentación", type: "expense" },
    { id: "salary", name: "Sueldo", type: "income" },
  ],
};
test("Las preguntas completan un ingreso y vinculan el destino correcto", () => {
  let draft = blankDraft(context);
  assert.equal(nextStep(draft, context), "type");
  for (const text of [
    "Ingreso",
    "2500",
    "Sueldo de octubre",
    "Yape",
    "Sueldo",
    "Hoy",
  ]) {
    const next = answerStep(draft, text, context);
    assert.ok(next);
    draft = next;
  }
  assert.equal(nextStep(draft, context), "confirm");
  const p = transactionPayload(draft, context);
  assert.equal(p.type, "income");
  assert.equal(p.amount, 2500);
  assert.equal(p.destination_account_id, "a");
  assert.equal("source_account_id" in p, false);
  assert.match(p.occurred_at!, /T/);
});
test("La extracción solo acepta cuentas y categorías existentes del contexto", () => {
  const d = draftFromExtraction(
    {
      type: "expense",
      amount: 25,
      currency: "PEN",
      description: "Almuerzo",
      account_id: "b",
      category_id: "salary",
    },
    context,
  );
  assert.equal(d.account_id, null);
  assert.equal(d.category_id, null);
  assert.equal(nextStep(d, context), "account");
  const account = answerStep(d, "Yape", context)!;
  assert.equal(nextStep(account, context), "category");
  const category = answerStep(account, "alimentacion", context)!;
  assert.equal(nextStep(category, context), "date");
  const dated = answerStep(category, "15/10/2026", context)!;
  assert.equal(nextStep(dated, context), "confirm");
  assert.equal(dated.date, "2026-10-15");
  assert.equal(transactionPayload(dated, context).source_account_id, "a");
});
test("Montos ambiguos, negativos y cuentas ambiguas se vuelven a preguntar", () => {
  assert.equal(parseAmount("S/ 25,50"), 25.5);
  assert.equal(parseAmount("25 soles"), 25);
  for (const text of ["-5", "0", "1,000", "25,555", "No sé", "25 o 30"])
    assert.equal(parseAmount(text), null);
  assert.equal(
    matchChoice("Yape", [
      { id: "a", name: "Yape" },
      { id: "b", name: "Yape" },
    ]),
    null,
  );
  assert.equal(matchChoice("no Yape", context.accounts), null);
  assert.throws(() => transactionPayload(blankDraft(context), context));
});
