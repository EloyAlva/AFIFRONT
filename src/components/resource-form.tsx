"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { X } from "lucide-react";
import { DateTime } from "luxon";
import { api } from "@/lib/api";
import { Button } from "./ui/button";
export type Row = Record<string, any>;
type Field = {
  key: string;
  label: string;
  type?: string;
  options?: [string, string][];
  required?: boolean;
  default?: any;
  full?: boolean;
};
const currencies: [string, string][] = [
  ["PEN", "Soles · PEN"],
  ["USD", "Dólares · USD"],
  ["EUR", "Euros · EUR"],
];
export const transactionTypes: [string, string][] = [
  ["expense", "Gasto"],
  ["income", "Ingreso"],
  ["transfer", "Transferencia"],
  ["card_payment", "Pago de tarjeta"],
  ["loan_payment", "Pago de préstamo"],
  ["obligation_payment", "Pago de obligación"],
  ["savings_reserve", "Reserva de ahorro"],
  ["savings_withdrawal", "Retiro de ahorro"],
  ["adjustment", "Ajuste de salida"],
];
export const labels: Record<string, string> = {
  distribution: "distribución",
  reallocation: "reasignación",
  statements: "estado bancario",
  occurrences: "vencimiento",
  accounts: "cuenta",
  categories: "categoría",
  transactions: "movimiento",
  cards: "tarjeta",
  debts: "préstamo",
  obligations: "obligación",
  budgets: "presupuesto",
  spaces: "espacio",
  goals: "objetivo",
  purchases: "compra de tarjeta",
  allocations: "asignación de ahorro",
  plans: "plan de ahorro",
  invitation: "invitación",
  participation: "participación",
};
export function ResourceForm({
  resource,
  data,
  initial = {},
  onClose,
  onSaved,
  onError,
  ai = false,
}: {
  resource: string;
  data: Record<string, Row[]>;
  initial?: Row;
  onClose: () => void;
  onSaved: (created?: Row) => void;
  onError: (s: string) => void;
  ai?: boolean;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
    setError,
    reset,
  } = useForm<Row>({ defaultValues: initial });
  const [localError, setLocalError] = useState("");
  const [link, setLink] = useState("");
  const [ratios, setRatios] = useState<Record<string, string>>({});
  const idempotency = useRef(crypto.randomUUID());
  const lastPayload = useRef("");
  const dialog = useRef<HTMLDivElement>(null);
  const values = watch();
  const type = values.type ?? initial.type ?? "expense";
  const options = (name: string): [string, string][] =>
    (data[name] ?? []).map((r) => [r.id, r.name ?? r.display_name ?? r.id]);
  const currentCurrency = values.currency ?? initial.currency ?? "PEN";
  const accountOptions: [string, string][] = (data.accounts ?? [])
    .filter((r) => r.active && r.currency === currentCurrency)
    .map((r) => [r.id, r.name]);
  const categoryOptions: [string, string][] = (data.categories ?? [])
    .filter((r) => r.type === (resource === "transactions" ? type : "expense"))
    .map((r) => [r.id, r.name]);
  const cur: Field = {
    key: "currency",
    label: "Moneda",
    type: "select",
    options: currencies,
    default: "PEN",
  };
  const amount: Field = {
    key: "amount",
    label: "Monto",
    type: "number",
    required: true,
  };
  const category: Field = {
    key: "category_id",
    label: "Categoría",
    type: "select",
    options: categoryOptions,
  };
  const name: Field = {
    key: "name",
    label: "Nombre",
    required: true,
    full: true,
  };
  const description: Field = {
    key: "description",
    label: "Descripción",
    required: true,
    full: true,
  };
  const now = DateTime.now().setZone(
    data.profile?.[0]?.timezone ?? "America/Lima",
  );
  const fields: Record<string, Field[]> = {
    distribution: [
      {
        key: "amount",
        label: "Monto del fondo a distribuir",
        type: "number",
        required: true,
      },
      cur,
      {
        key: "distribution",
        label: "Porcentaje para cada destino (total: 100%)",
        type: "ratios",
        required: true,
        full: true,
      },
    ],
    reallocation: [
      {
        key: "from_goal",
        label: "Desde objetivo",
        type: "select",
        options: options("goals"),
        required: true,
      },
      {
        key: "to_goal",
        label: "Hacia objetivo",
        type: "select",
        options: options("goals"),
        required: true,
      },
      amount,
    ],
    statements: [
      {
        key: "card_id",
        label: "Tarjeta",
        type: "select",
        options: options("cards"),
        required: true,
      },
      {
        key: "period",
        label: "Período del estado bancario",
        type: "month",
        default: now.toFormat("yyyy-MM"),
        required: true,
      },
      {
        key: "closing_date",
        label: "Fecha de cierre",
        type: "date",
        required: true,
      },
      {
        key: "due_date",
        label: "Fecha límite de pago",
        type: "date",
        required: true,
      },
      {
        key: "amount",
        label: "Total facturado / exigible",
        type: "number",
        required: true,
      },
      {
        key: "minimum_payment",
        label: "Pago mínimo informado por el banco",
        type: "number",
        required: true,
      },
    ],
    occurrences: [
      {
        key: "amount",
        label: "Importe exigible de este período",
        type: "number",
        required: true,
      },
      {
        key: "due_date",
        label: "Fecha límite de este período",
        type: "date",
        required: true,
      },
    ],
    accounts: [
      name,
      {
        key: "type",
        label: "Tipo de cuenta",
        type: "select",
        options: [
          ["bank", "Cuenta bancaria"],
          ["cash", "Efectivo"],
          ["wallet", "Billetera digital"],
          ["savings", "Cuenta de ahorro"],
          ["other", "Otra"],
        ],
      },
      cur,
      {
        key: "opening_balance",
        label: "Saldo inicial (no es ingreso)",
        type: "number",
        default: 0,
        required: true,
      },
    ],
    categories: [
      name,
      {
        key: "type",
        label: "Tipo",
        type: "select",
        options: [
          ["expense", "Egreso (gasto)"],
          ["income", "Ingreso"],
        ],
      },
    ],
    cards: [
      name,
      { key: "bank", label: "Banco", required: true },
      cur,
      {
        key: "credit_limit",
        label: "Línea de crédito",
        type: "number",
        required: true,
      },
      {
        key: "initial_debt",
        label: "Deuda inicial",
        type: "number",
        default: 0,
      },
      {
        key: "closing_day",
        label: "Día de cierre (1–31)",
        type: "number",
        required: true,
      },
      {
        key: "due_day",
        label: "Día de pago (1–31)",
        type: "number",
        required: true,
      },
      {
        key: "utilization_limit",
        label: "Límite personal (%)",
        type: "number",
        default: 50,
      },
    ],
    debts: [
      name,
      { key: "creditor", label: "Acreedor", required: true },
      cur,
      {
        key: "principal",
        label: "Monto original",
        type: "number",
        required: true,
      },
      {
        key: "annual_interest",
        label: "Interés nominal anual (%)",
        type: "number",
        default: 0,
      },
      {
        key: "installments",
        label: "Número de cuotas",
        type: "number",
        required: true,
      },
      {
        key: "first_due_date",
        label: "Primer vencimiento",
        type: "date",
        required: true,
      },
    ],
    obligations: [
      name,
      {
        key: "type",
        label: "Tipo",
        type: "select",
        options: [
          ["service", "Servicio"],
          ["rent", "Alquiler"],
          ["subscription", "Suscripción"],
          ["card", "Tarjeta"],
          ["loan", "Préstamo"],
          ["other", "Otro"],
        ],
      },
      { key: "entity", label: "Entidad" },
      amount,
      cur,
      {
        key: "frequency",
        label: "Frecuencia",
        type: "select",
        options: [
          ["monthly", "Mensual"],
          ["yearly", "Anual"],
          ["once", "Una vez"],
        ],
      },
      {
        key: "start_date",
        label: "Fecha inicial / vencimiento",
        type: "date",
        required: true,
      },
      { key: "end_date", label: "Fecha final (opcional)", type: "date" },
      {
        key: "account_id",
        label: "Cuenta habitual",
        type: "select",
        options: accountOptions,
      },
      {
        key: "card_id",
        label: "Tarjeta vinculada (opcional)",
        type: "select",
        options: options("cards"),
      },
      {
        key: "debt_id",
        label: "Préstamo vinculado (opcional)",
        type: "select",
        options: options("debts"),
      },
      { key: "notes", label: "Observaciones", full: true },
    ],
    budgets: [
      {
        key: "month",
        label: "Mes",
        type: "month",
        default: now.toFormat("yyyy-MM"),
        required: true,
      },
      cur,
      category,
      amount,
    ],
    spaces: [name],
    goals: [
      name,
      { key: "description", label: "Descripción", full: true },
      {
        key: "space_id",
        label: "Espacio (vacío = privado)",
        type: "select",
        options: options("spaces"),
      },
      cur,
      {
        key: "minimum_amount",
        label: "Monto mínimo",
        type: "number",
        default: 0,
      },
      {
        key: "ideal_amount",
        label: "Importe total del objetivo",
        type: "number",
        required: true,
      },
      {
        key: "start_date",
        label: "Fecha de inicio",
        type: "date",
        default: now.toISODate(),
        required: true,
      },
      {
        key: "target_date",
        label: "Fecha objetivo",
        type: "date",
        required: true,
      },
      {
        key: "priority",
        label: "Prioridad",
        type: "select",
        options: [
          ["1", "Alta"],
          ["2", "Media"],
          ["3", "Baja"],
        ],
        default: "2",
      },
    ],
    purchases: [
      {
        key: "card_id",
        label: "Tarjeta",
        type: "select",
        options: options("cards"),
        required: true,
      },
      {
        key: "kind",
        label: "Operación",
        type: "select",
        options: [
          ["purchase", "Compra"],
          ["interest", "Interés"],
          ["fee", "Comisión"],
          ["refund", "Devolución"],
        ],
      },
      amount,
      {
        key: "installments",
        label: "Cuotas",
        type: "number",
        default: 1,
        required: true,
      },
      {
        key: "purchased_at",
        label: "Fecha",
        type: "date",
        default: now.toISODate(),
        required: true,
      },
      category,
      description,
    ],
    allocations: [
      {
        key: "goal_id",
        label: "Objetivo",
        type: "select",
        options: options("goals"),
        required: true,
      },
      { ...amount, label: "Monto (+ aportar / − retirar)" },
    ],
    plans: [
      {
        key: "goal_id",
        label: "Objetivo",
        type: "select",
        options: options("goals"),
        required: true,
      },
      {
        key: "month",
        label: "Mes",
        type: "month",
        default: now.toFormat("yyyy-MM"),
        required: true,
      },
      { ...amount, label: "Monto planificado (admite 0)" },
    ],
    invitation: [
      {
        key: "space_id",
        label: "Espacio",
        type: "select",
        options: options("spaces"),
        required: true,
      },
      {
        key: "email",
        label: "Correo del invitado",
        type: "email",
        required: true,
      },
    ],
    participation: [
      {
        key: "goal_id",
        label: "Objetivo compartido",
        type: "select",
        options: (data.goals ?? [])
          .filter(
            (g) =>
              g.space_id &&
              data.members?.some(
                (m) =>
                  m.space_id === g.space_id &&
                  m.user_id === data.profile?.[0]?.id &&
                  m.role === "admin",
              ),
          )
          .map((g) => [g.id, g.name]),
        required: true,
      },
      {
        key: "members",
        label: "Participación de cada persona (total: 100%)",
        type: "ratios",
        required: true,
        full: true,
      },
    ],
    transactions: [
      {
        key: "type",
        label: "Tipo",
        type: "select",
        options: ai
          ? transactionTypes.filter((t) => ["income", "expense"].includes(t[0]))
          : transactionTypes,
        default: "expense",
      },
      amount,
      cur,
      {
        key: "occurred_at",
        label: "Fecha y hora",
        type: "datetime-local",
        default: now.toFormat("yyyy-MM-dd'T'HH:mm"),
        required: true,
      },
      ...(["income"].includes(type)
        ? []
        : [
            {
              key: "source_account_id",
              label: "Cuenta de origen",
              type: "select",
              options: accountOptions,
              required: true,
            },
          ]),
      ...(["income", "transfer"].includes(type)
        ? [
            {
              key: "destination_account_id",
              label: "Cuenta de destino",
              type: "select",
              options: accountOptions,
              required: true,
            },
          ]
        : []),
      ...(["income", "expense"].includes(type) ? [category] : []),
      ...(type === "card_payment"
        ? [
            {
              key: "card_id",
              label: "Tarjeta",
              type: "select",
              options: options("cards"),
              required: true,
            },
          ]
        : []),
      ...(type === "loan_payment"
        ? [
            {
              key: "debt_id",
              label: "Préstamo",
              type: "select",
              options: options("debts"),
              required: true,
            },
          ]
        : []),
      ...(type === "obligation_payment" || initial.occurrence_id
        ? [
            {
              key: "occurrence_id",
              label: "Vencimiento",
              type: "select",
              options: (data.occurrences ?? []).map((o): [string, string] => [
                o.id,
                (data.obligations ?? []).find((b) => b.id === o.obligation_id)
                  ?.name +
                  " · " +
                  o.due_date,
              ]),
              required: true,
            },
          ]
        : []),
      description,
      { key: "payment_method", label: "Medio de pago" },
      { key: "notes", label: "Observaciones" },
    ],
  };
  const editFields: Record<string, string[]> = {
    spaces: ["name"],
    accounts: ["name"],
    categories: ["name"],
    cards: ["name", "bank", "closing_day", "due_day", "utilization_limit"],
    debts: ["name", "creditor"],
    obligations: ["name", "entity", "amount", "frequency", "end_date", "notes"],
    occurrences: ["amount", "due_date"],
    budgets: ["amount"],
    goals: [
      "name",
      "description",
      "minimum_amount",
      "ideal_amount",
      "target_date",
      "start_date",
      "priority",
    ],
  };
  const selected = (fields[resource] ?? []).filter(
    (f) =>
      (!initial._editId ||
        resource === "transactions" ||
        editFields[resource]?.includes(f.key)) &&
      !(
        resource === "goals" &&
        initial._editId &&
        f.key === "start_date" &&
        !initial.start_date
      ),
  );
  const ratioItems: [string, string][] =
    resource === "distribution"
      ? [
          ...(data.goals ?? [])
            .filter((g) => g.currency === currentCurrency)
            .map((g): [string, string] => [g.id, g.name]),
          ["unassigned", "Sin asignar"],
        ]
      : (data.members ?? [])
          .filter(
            (m) =>
              m.space_id ===
              (data.goals ?? []).find((g) => g.id === values.goal_id)?.space_id,
          )
          .map((m) => [m.user_id, m.display_name || "Participante"]);
  useEffect(() => {
    if (resource !== "participation") return;
    const existing = (data["goal-members"] ?? []).filter(
      (m) => m.goal_id === values.goal_id,
    );
    setRatios(
      Object.fromEntries(
        existing.map((m) => [m.user_id, String(m.percentage)]),
      ),
    );
  }, [resource, values.goal_id, data]);
  useEffect(() => {
    const first = dialog.current?.querySelector<HTMLElement>(
      "input,select,textarea,button",
    );
    first?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const focusable = dialog.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,select,textarea,a",
        );
        if (!focusable?.length) return;
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", listener);
      document.body.style.overflow = before;
    };
  }, [onClose]);
  const submit = handleSubmit(async (raw) => {
    setLocalError("");
    try {
      const p: Row = {};
      for (const f of selected) {
        const value =
          raw[f.key] ??
          f.default ??
          (f.type === "select" && f.required !== false
            ? f.options?.[0]?.[0]
            : undefined);
        if (value !== "" && value != null)
          p[f.key] = f.type === "number" ? Number(value) : value;
      }
      if (p.month) p.month += "-01";
      if (p.period) p.period += "-01";
      if (resource === "transactions")
        p.occurred_at = DateTime.fromISO(p.occurred_at, {
          zone: data.profile?.[0]?.timezone ?? "America/Lima",
        }).toISO();
      if (resource === "goals") p.priority = Number(p.priority ?? 2);
      z.record(z.string(), z.unknown()).parse(p);
      const serialized = JSON.stringify({ p, ratios });
      if (lastPayload.current && lastPayload.current !== serialized)
        idempotency.current = crypto.randomUUID();
      lastPayload.current = serialized;
      if (resource === "invitation") {
        const r = await api("/spaces/" + p.space_id + "/invitations", "POST", {
          email: p.email,
        });
        setLink(window.location.origin + "/?invitation=" + r.token);
        return;
      }
      let created: Row | undefined;
      if (resource === "participation") {
        const members = ratioItems.map(([user_id]) => ({
          user_id,
          percentage: Number(ratios[user_id] ?? 0),
        }));
        if (
          Math.abs(members.reduce((s, m) => s + m.percentage, 0) - 100) > 0.001
        )
          throw new Error("Los porcentajes de participación deben sumar 100%.");
        await api("/goals/" + p.goal_id + "/members", "PUT", { members });
      } else if (ai) {
        const draft = await api("/ai/drafts", "POST", p);
        await api(
          "/ai/drafts/" + draft.id + "/confirm",
          "POST",
          { confirmed: true },
          idempotency.current,
        );
      } else if (resource === "distribution") {
        p.distribution = ratioItems.map(([goal_id]) => ({
          goal_id: goal_id === "unassigned" ? null : goal_id,
          percentage: Number(ratios[goal_id] ?? 0),
        }));
        await api("/savings/distribute", "POST", p, idempotency.current);
      } else if (resource === "reallocation")
        await api("/savings/reallocate", "POST", p, idempotency.current);
      else if (initial._editId)
        await api(
          "/" + resource + "/" + initial._editId,
          resource === "transactions" ? "PUT" : "PATCH",
          p,
          idempotency.current,
        );
      else {
        const result = await api(
          "/" + resource,
          "POST",
          p,
          idempotency.current,
        );
        created = { resource, id: result.id, space_id: p.space_id };
      }
      reset();
      onSaved(created);
    } catch (error) {
      setLocalError((error as Error).message);
      setError("root", { message: (error as Error).message });
    }
  });
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-title"
        ref={dialog}
      >
        <div className="modal-head">
          <h2 id="form-title">
            {ai
              ? "Revisar y confirmar"
              : (initial._editId ? "Editar " : "Registrar ") +
                (labels[resource] ?? resource)}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={19} />
          </Button>
        </div>
        {ai && (
          <div className="callout">
            <p>
              Revisa todos los datos. El movimiento se registrará solo al pulsar
              «Confirmar registro».
            </p>
          </div>
        )}
        {link ? (
          <>
            <p className="detail">
              Comparte este enlace con la persona invitada. Deberá iniciar
              sesión con el correo indicado. Expira en 7 días.
            </p>
            <textarea
              readOnly
              value={link}
              aria-label="Enlace seguro"
              style={{ marginTop: 15 }}
            />
            <Button
              className="mt-4"
              onClick={() => {
                navigator.clipboard
                  .writeText(link)
                  .catch(() => onError("Copia el enlace manualmente"));
              }}
            >
              Copiar enlace
            </Button>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="form-grid">
              {selected.map((f) =>
                f.type === "ratios" ? (
                  <fieldset
                    key={f.key}
                    className="full"
                    style={{ border: 0, padding: 0, margin: 0 }}
                  >
                    <legend
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        marginBottom: 12,
                      }}
                    >
                      {f.label}
                    </legend>
                    {resource === "distribution" && (
                      <div style={{ marginBottom: 16 }}>
                        <p className="detail">
                          El backend calcula la sugerencia con saldos,
                          vencimientos, responsabilidades y presupuestos
                          futuros. Ingresa primero el importe del fondo. Puedes
                          ajustar el reparto antes de confirmar; los redondeos
                          sin asignar permanecen en el fondo.
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              setLocalError("");
                              const amount = Number(values.amount);
                              if (!(amount > 0))
                                throw new Error(
                                  "Ingresa un importe mayor que cero para calcular el reparto.",
                                );
                              const suggestion = await api(
                                `/savings/planner?currency=${currentCurrency}&month=${now.toFormat("yyyy-MM")}&fund_amount=${amount}`,
                              );
                              const result: Record<string, string> =
                                Object.fromEntries(
                                  ratioItems.map(([id]) => [id, "0"]),
                                );
                              let assigned = 0;
                              for (const allocation of suggestion.schedule[0]
                                .allocations) {
                                const percentage = Math.floor(
                                  (allocation.amount / amount) * 10000,
                                );
                                assigned += percentage;
                                result[allocation.goal_id] = String(
                                  percentage / 100,
                                );
                              }
                              result.unassigned = String(
                                (10000 - assigned) / 100,
                              );
                              setRatios(result);
                            } catch (e) {
                              setLocalError((e as Error).message);
                            }
                          }}
                        >
                          Calcular reparto dinámico
                        </Button>
                      </div>
                    )}
                    {ratioItems.length ? (
                      ratioItems.map(([id, label]) => (
                        <label
                          key={id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 100px",
                            alignItems: "center",
                            marginBottom: 10,
                          }}
                        >
                          {label}
                          <input
                            aria-label={"Porcentaje " + label}
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={ratios[id] ?? ""}
                            placeholder="0 %"
                            onChange={(e) =>
                              setRatios((r) => ({ ...r, [id]: e.target.value }))
                            }
                          />
                        </label>
                      ))
                    ) : (
                      <p className="detail">
                        Selecciona un objetivo para ver sus participantes.
                      </p>
                    )}
                    <small>
                      Total:{" "}
                      {ratioItems
                        .reduce((sum, [id]) => sum + Number(ratios[id] ?? 0), 0)
                        .toFixed(2)}
                      %
                    </small>
                  </fieldset>
                ) : (
                  <label className={f.full ? "full" : ""} key={f.key}>
                    {f.label}
                    {f.required ? " *" : ""}
                    {f.type === "select" ? (
                      <select
                        {...register(f.key)}
                        defaultValue={
                          initial[f.key] ??
                          f.default ??
                          (["type", "kind", "frequency"].includes(f.key)
                            ? f.options?.[0]?.[0]
                            : "")
                        }
                        required={f.required}
                      >
                        <option value="">
                          {f.required ? "Seleccionar…" : "Sin seleccionar"}
                        </option>
                        {f.options?.map(([id, label]) => (
                          <option value={id} key={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    ) : f.type === "textarea" ? (
                      <textarea
                        {...register(f.key)}
                        rows={5}
                        required={f.required}
                      />
                    ) : (
                      <input
                        {...register(f.key)}
                        type={f.type ?? "text"}
                        defaultValue={initial[f.key] ?? f.default ?? ""}
                        required={f.required}
                        step={f.type === "number" ? "0.01" : undefined}
                        maxLength={f.type === "number" ? undefined : 2000}
                      />
                    )}
                  </label>
                ),
              )}
            </div>
            {localError && (
              <p className="error-text" role="alert" style={{ marginTop: 16 }}>
                {localError}
              </p>
            )}
            <div className="form-footer">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Guardando…"
                  : ai
                    ? "Confirmar registro"
                    : "Guardar " + (labels[resource] ?? "")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
