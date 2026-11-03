"use client";
import { useCallback, useEffect, useState } from "react";
import { api, formatMoney } from "@/lib/api";
import { Button } from "./ui/button";
import type { Row } from "./resource-form";

function usePlanning(path: string, revision: unknown) {
  const [value, setValue] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    setError("");
    setValue(null);
    api(path)
      .then((r) => {
        if (active) setValue(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [path, revision, version]);
  return { value, error, refresh };
}
function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ margin: "12px 0" }}>
      <p className="detail">
        {label}: {value.toFixed(1)}%
      </p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.max(0, value))}
        style={{ height: 7, borderRadius: 8, background: "#e2e8f0" }}
      >
        <div
          style={{
            width: `${Math.min(100, Math.max(0, value))}%`,
            height: "100%",
            borderRadius: 8,
            background: "#2563eb",
          }}
        />
      </div>
    </div>
  );
}
const statusLabels: Record<string, string> = {
  completed: "Completado",
  overdue: "Vencido",
  behind: "Por debajo del ahorro esperado",
  on_track: "Al día",
  planned: "Cubierto por planes autorizados",
  shortfall: "Plan insuficiente",
  unknown: "Sin plan autorizado suficiente",
};
function Numbers({
  values,
  currency,
}: {
  values: [string, number | string][];
  currency: string;
}) {
  return (
    <div className="planning-numbers">
      {values.map(([label, value]) => (
        <div key={label} style={{ padding: "10px 0", minWidth: 0 }}>
          <small>{label}</small>
          <p style={{ fontWeight: 650, overflowWrap: "anywhere" }}>
            {typeof value === "number" ? formatMoney(value, currency) : value}
          </p>
        </div>
      ))}
    </div>
  );
}
function MonthlyAllocationIndicator({
  plan,
  month,
  currency,
}: {
  plan: Row;
  month: string;
  currency: string;
}) {
  const row = plan.schedule.find((s: Row) => s.month === month);
  const budget = plan.budgets.find((b: Row) => b.month === month);
  if (!row || !budget) return null;
  const required =
    Math.round(
      plan.goals
        .filter(
          (g: Row) =>
            !g.participationMissing &&
            g.status !== "completed" &&
            g.status !== "overdue",
        )
        .reduce(
          (sum: number, g: Row) => sum + Number(g.monthlyRequired ?? 0),
          0,
        ) * 100,
    ) / 100;
  return (
    <section
      className="card"
      aria-label="Indicador de ahorro y asignación mensual"
      style={{ margin: "20px 0" }}
    >
      <h2>Cuánto ahorrar y a qué objetivos · {month}</h2>
      <Numbers
        currency={currency}
        values={[
          ...(month === plan.startMonth
            ? [
                ["Necesidad mensual pendiente de tus objetivos", required] as [
                  string,
                  number,
                ],
              ]
            : []),
          [
            "Ahorro mensual recomendado",
            Math.round((Number(row.budget) + Number(budget.confirmed)) * 100) /
              100,
          ],
          ["Ya aportado este mes", Number(budget.confirmed)],
          ["Pendiente recomendado este mes", Number(row.budget)],
        ]}
      />
      {month === plan.startMonth && required > Number(row.budget) && (
        <p className="negative">
          Tus objetivos requieren más ahorro mensual del que permite el
          presupuesto recomendado. Revisa los déficits, las fechas y las metas
          en el planificador.
        </p>
      )}
      <p className="detail">
        El importe recomendado respeta tu porcentaje de ahorro y tu capacidad
        disponible. El porcentaje de cada objetivo se calcula sobre el importe
        pendiente recomendado de este mes, según la distribución del
        planificador.
      </p>
      <div className="grid-2">
        {plan.goals.map((g: Row) => {
          const amount = Number(
            row.allocations.find((a: Row) => a.goal_id === g.id)?.amount ?? 0,
          );
          const confirmed = (plan.confirmedContributions ?? [])
            .filter((a: Row) => a.goal_id === g.id && a.month === month)
            .reduce((sum: number, a: Row) => sum + Number(a.amount), 0);
          const percentage = row.budget > 0 ? (amount / row.budget) * 100 : 0;
          return (
            <div
              key={g.id}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid #e2e8f0",
                minWidth: 0,
              }}
            >
              <h3>{g.name}</h3>
              <p>
                <strong>{formatMoney(amount, currency)}</strong> por aportar ·{" "}
                {percentage.toFixed(2)}% de asignación
              </p>
              <Meter
                label={`Asignación mensual de ${g.name}`}
                value={percentage}
              />
              <p className="detail">
                Ya aportado: {formatMoney(confirmed, currency)} · Total del mes
                previsto:{" "}
                {formatMoney(
                  Math.round((amount + confirmed) * 100) / 100,
                  currency,
                )}
                .
              </p>
              {g.participationMissing && (
                <small>
                  Falta definir tu responsabilidad en este objetivo.
                </small>
              )}
            </div>
          );
        })}
      </div>
      {!plan.goals.length && (
        <p className="detail">Crea objetivos para distribuir tu ahorro.</p>
      )}
      <p className="detail" style={{ marginTop: 16 }}>
        Sin asignar a objetivos: {formatMoney(Number(row.unassigned), currency)}{" "}
        ({(row.budget > 0 ? (row.unassigned / row.budget) * 100 : 0).toFixed(2)}
        %). Los porcentajes mostrados se redondean; los importes del
        planificador son los que se aplican.
      </p>
      <small>
        Es una recomendación. Los aportes aumentan el progreso únicamente cuando
        los confirmas. Si editas el reparto, guarda el plan para actualizar este
        indicador.
      </small>
    </section>
  );
}

export function MonthlySavingsIndicator({
  currency,
  month,
  data,
}: {
  currency: string;
  month: string;
  data: Record<string, Row[]>;
}) {
  const { value: plan, error } = usePlanning(
    `/savings/planner?currency=${currency}&month=${month}`,
    data,
  );
  if (error)
    return (
      <p className="detail">
        El indicador de asignación mensual estará disponible cuando se pueda
        cargar el planificador.
      </p>
    );
  if (!plan?.schedule || !plan?.budgets || !plan?.goals) return null;
  return (
    <MonthlyAllocationIndicator
      plan={plan}
      month={plan.startMonth}
      currency={currency}
    />
  );
}
function GoalDetail({
  goal,
  plans,
  data,
  onContribute,
}: {
  goal: Row;
  plans: Row[];
  data: Record<string, Row[]>;
  onContribute: (goal: Row) => void;
}) {
  const members = (goal.participants ?? []) as Row[];
  const name = (id: string) =>
    id === data.profile?.[0]?.id
      ? "Tú"
      : (data.members ?? []).find(
          (m) => m.space_id === goal.space_id && m.user_id === id,
        )?.display_name || "Participante";
  const goalPlans = plans.filter((p) => p.goal_id === goal.id);
  return (
    <details className="card" style={{ marginTop: 14 }}>
      <summary style={{ cursor: "pointer", fontWeight: 650 }}>
        Detalle de {goal.name} · {statusLabels[goal.status]}
      </summary>
      <p className="detail" style={{ marginTop: 14 }}>
        {goal.description}
      </p>
      <p className="detail">
        Inicio: {goal.start_date} · Fecha límite: {goal.target_date} ·
        Prioridad:{" "}
        {goal.priority === 1 ? "Alta" : goal.priority === 3 ? "Baja" : "Media"}
      </p>
      <Meter label="Avance financiero" value={goal.progress} />
      <Meter label="Tiempo transcurrido" value={goal.elapsedPercentage} />
      <Numbers
        currency={goal.currency}
        values={[
          ["Meta del objetivo", Number(goal.ideal_amount)],
          ["Aportes confirmados", goal.confirmed],
          ["Saldo pendiente", goal.remaining],
          ["Meses restantes", String(goal.monthsRemaining)],
          ["Días restantes", String(goal.daysRemaining)],
          ["Ahorro mensual requerido", goal.monthlyRequired],
          ["Ahorro esperado a la fecha", goal.expectedSaved],
          ["Falta frente al avance esperado", goal.shortfallToDate],
          ["Déficit frente a planes autorizados", goal.projectedDeficit],
        ]}
      />
      <p className="detail">
        Viabilidad: {statusLabels[goal.viability]}. Proyección con planes
        autorizados:{" "}
        {goal.status === "completed"
          ? "ya completado"
          : (goal.estimatedCompletion ?? "sin fecha calculable")}
        . Los planes no garantizan aportes futuros.
      </p>
      <h3 style={{ marginTop: 20 }}>Participantes y responsabilidad</h3>
      {members.length ? (
        members.map((m) => (
          <div className="list-row" key={m.user_id}>
            <span>
              {name(m.user_id)} · {m.percentage}%
            </span>
            <strong>
              {formatMoney(Number(m.target_amount), goal.currency)}
            </strong>
          </div>
        ))
      ) : (
        <p className="detail">
          {goal.space_id
            ? "El administrador debe definir la responsabilidad de los participantes."
            : "Objetivo personal: responsabilidad del 100%."}
        </p>
      )}
      <h3 style={{ marginTop: 20 }}>Calendario de aportes planificados</h3>
      <p className="detail">
        Solo se muestran planes autorizados en objetivos compartidos. No
        incluyen ingresos, cuentas ni capacidad privada.
      </p>
      <div style={{ maxHeight: 300, overflowY: "auto" }}>
        {goalPlans.length ? (
          goalPlans.map((p) => (
            <div className="list-row" key={p.id}>
              <span>
                {p.month.slice(0, 7)} · {name(p.user_id)}
              </span>
              <strong>{formatMoney(Number(p.amount), goal.currency)}</strong>
            </div>
          ))
        ) : (
          <p className="detail">No hay planes visibles.</p>
        )}
      </div>
      <h3 style={{ marginTop: 20 }}>Historial de aportes confirmados</h3>
      <div style={{ maxHeight: 300, overflowY: "auto" }}>
        {goal.history.length ? (
          goal.history.map((a: Row) => (
            <div className="list-row" key={a.id}>
              <span>
                {String(a.created_at).slice(0, 10)} · {name(a.user_id)}
              </span>
              <strong>{formatMoney(Number(a.amount), goal.currency)}</strong>
            </div>
          ))
        ) : (
          <p className="detail">Todavía no hay aportes confirmados.</p>
        )}
      </div>
      {goal.status !== "completed" && (
        <Button variant="outline" onClick={() => onContribute(goal)}>
          Registrar aporte con confirmación
        </Button>
      )}
    </details>
  );
}

export function SavingsOverview({
  mode,
  currency,
  month,
  data,
  onContribute,
}: {
  mode: "spaces" | "goals";
  currency: string;
  month: string;
  data: Record<string, Row[]>;
  onContribute: (goal: Row) => void;
}) {
  const { value, error } = usePlanning(
    `/savings/overview?currency=${currency}&month=${month}`,
    data,
  );
  if (error)
    return (
      <p role="alert" className="callout">
        No se pudo cargar la planificación: {error}
      </p>
    );
  if (!value?.goals || !value?.spaces)
    return <p className="detail">Cargando planificación…</p>;
  if (mode === "goals")
    return (
      <section style={{ margin: "20px 0" }}>
        <h2>Detalle y calendario de objetivos</h2>
        <p className="detail">
          El progreso financiero cuenta exclusivamente aportes confirmados. El
          avance del tiempo se mide por separado.
        </p>
        {value.goals.map((g: Row) => (
          <GoalDetail
            key={g.id}
            goal={g}
            plans={value.plans}
            data={data}
            onContribute={onContribute}
          />
        ))}
      </section>
    );
  return (
    <div style={{ margin: "20px 0" }}>
      {value.spaces.map((s: Row) => (
        <section className="card" key={s.id} style={{ marginBottom: 20 }}>
          <h2>
            {s.name} · Resumen de objetivos ({currency})
          </h2>
          <p className="detail">
            El importe consolidado corresponde a la suma de los objetivos de
            esta moneda. El espacio no tiene una meta monetaria propia.
          </p>
          <Numbers
            currency={currency}
            values={[
              ["Meta total de objetivos", s.target],
              ["Ahorro confirmado", s.confirmed],
              ["Total pendiente", s.remaining],
              ["Objetivos", String(s.goalCount)],
              ["Completados", String(s.completed)],
              ["En riesgo o sin plan suficiente", String(s.atRisk)],
              ["Ahorro mensual requerido", s.monthlyRequired],
              ["Planificado autorizado este mes", s.monthlyPlanned],
              ["Confirmado este mes", s.monthlyConfirmed],
            ]}
          />
          <Meter label="Avance global de objetivos" value={s.progress} />
          <h3>Objetivos y próximos vencimientos</h3>
          {[...s.goals]
            .sort((a, b) => a.target_date.localeCompare(b.target_date))
            .map((g: Row) => (
              <GoalDetail
                key={g.id}
                goal={g}
                plans={value.plans}
                data={data}
                onContribute={onContribute}
              />
            ))}
          {!s.goalCount && (
            <p className="detail">No hay objetivos en esta moneda.</p>
          )}
        </section>
      ))}
    </div>
  );
}

export function SavingsPlanner({
  currency,
  month,
  data,
  userId,
  onChanged,
  onContribute,
}: {
  currency: string;
  month: string;
  data: Record<string, Row[]>;
  userId: string;
  onChanged: () => Promise<void>;
  onContribute: (goal: Row) => void;
}) {
  const {
    value: plan,
    error,
    refresh,
  } = usePlanning(`/savings/planner?currency=${currency}&month=${month}`, data);
  const [selected, setSelected] = useState(month);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [sharing, setSharing] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [localError, setLocalError] = useState("");
  useEffect(() => {
    if (plan?.startMonth) setSelected(plan.startMonth);
  }, [plan]);
  useEffect(() => {
    const row = plan?.schedule?.find((s: Row) => s.month === selected);
    if (!row) return;
    setDraft(
      Object.fromEntries(
        plan!.goals.map((g: Row) => [
          g.id,
          String(
            row.allocations.find((a: Row) => a.goal_id === g.id)?.amount ?? 0,
          ),
        ]),
      ),
    );
    setSharing(
      Object.fromEntries(
        (data.plans ?? [])
          .filter((p) => p.user_id === userId && p.month.startsWith(selected))
          .map((p) => [p.goal_id, p.share_authorized === true]),
      ),
    );
  }, [plan, selected, data, userId]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setLocalError("");
    setMessage("");
    try {
      await action();
      setMessage(
        "Planificación guardada. No se ha reservado ni transferido dinero.",
      );
      await onChanged();
      refresh();
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (error)
    return (
      <p className="callout" role="alert">
        No se pudo cargar el planificador: {error}
      </p>
    );
  if (!plan?.budgets?.length || !plan?.schedule)
    return <p>Cargando planificador…</p>;
  const first = plan.budgets[0];
  const budget = plan.budgets.find((b: Row) => b.month === selected);
  const row = plan.schedule.find((s: Row) => s.month === selected);
  const pending =
    Object.values(draft).reduce(
      (s, v) => s + Math.round(Number(v || 0) * 100),
      0,
    ) / 100;
  return (
    <>
      <div className="callout">
        <div>
          <h3>Tu capacidad financiera es privada</h3>
          <p>{plan.assumption}</p>
          <p>
            Recomendación → planificación → reserva → aporte confirmado. Guardar
            un plan no mueve dinero. Cada aporte real se registra y confirma por
            separado.
          </p>
        </div>
      </div>
      {plan.startMonth !== month && (
        <p className="callout">
          El mes seleccionado ya pasó. Las recomendaciones empiezan en{" "}
          {plan.startMonth}.
        </p>
      )}
      {plan.horizonLimited && (
        <p role="alert" className="callout">
          La proyección muestra como máximo 600 meses. Los objetivos posteriores
          necesitan una revisión adicional; no se consideran garantizados.
        </p>
      )}
      {localError && <p role="alert">{localError}</p>}
      {message && <p role="status">{message}</p>}
      <section className="card" style={{ margin: "20px 0" }}>
        <h2>Presupuesto mensual privado · {plan.startMonth}</h2>
        <p className="detail">
          Los importes se mantienen como previsión para los meses siguientes
          hasta que guardes otra configuración. Registra un cambio seleccionando
          su mes arriba. Los compromisos conocidos y los gastos esenciales
          reducen el presupuesto recomendado.
        </p>
        <form
          key={JSON.stringify(first)}
          className="settings-form"
          style={{ marginTop: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(() =>
              api("/savings/planner/budget", "PUT", {
                currency,
                month: plan.startMonth + "-01",
                monthly_income: Number(f.get("income")),
                savings_percentage: Number(f.get("percentage")),
                maximum_savings: Number(f.get("maximum")),
                essential_expenses: Number(f.get("essential")),
              }),
            );
          }}
        >
          <label>
            Ingreso mensual previsto
            <input
              name="income"
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue={first.monthlyIncome}
            />
          </label>
          <label>
            Porcentaje deseado de ahorro
            <input
              name="percentage"
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
              defaultValue={first.savingsPercentage}
            />
          </label>
          <label>
            Máximo mensual para ahorrar
            <input
              name="maximum"
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue={first.maximumSavings}
            />
          </label>
          <label>
            Gastos esenciales mensuales previstos
            <input
              name="essential"
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue={first.essentialExpenses}
            />
          </label>
          <Button disabled={busy}>
            Guardar presupuesto privado y recalcular
          </Button>
        </form>
      </section>
      <section className="card" style={{ marginBottom: 20 }}>
        <h2>Distribución mensual recomendada</h2>
        <label>
          Mes del calendario
          <select
            aria-label="Mes del calendario"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {plan.schedule.map((s: Row) => (
              <option key={s.month} value={s.month}>
                {s.month}
              </option>
            ))}
          </select>
        </label>
        <Numbers
          currency={currency}
          values={[
            ["Ahorro deseado", budget.desired],
            ["Financieramente disponible", budget.financiallyAvailable],
            ["Obligaciones pendientes", budget.pendingObligations],
            ["Aportes ya confirmados", budget.confirmed],
            ["Presupuesto pendiente recomendado", row.budget],
            ["Sugerido a objetivos", row.assigned],
          ]}
        />
        <MonthlyAllocationIndicator
          plan={plan}
          month={selected}
          currency={currency}
        />
        <p className="detail">
          Puedes modificar los importes pendientes. Al guardar, se incluyen los
          aportes ya confirmados de ese mes en el total del plan. Autorizar
          compartir solo publica tu aporte planificado; nunca tu ingreso ni tu
          capacidad.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (Math.round(pending * 100) > Math.round(row.budget * 100)) {
              setLocalError(
                "La distribución supera el presupuesto disponible de este mes.",
              );
              return;
            }
            const entries = plan.goals
              .filter((g: Row) => !g.participationMissing)
              .map((g: Row) => {
                const confirmed = plan.confirmedContributions
                  .filter(
                    (a: Row) => a.goal_id === g.id && a.month === selected,
                  )
                  .reduce((s: number, a: Row) => s + Number(a.amount), 0);
                return {
                  goal_id: g.id,
                  month: selected + "-01",
                  amount:
                    Math.round((Number(draft[g.id] || 0) + confirmed) * 100) /
                    100,
                  share_authorized: sharing[g.id] ?? false,
                };
              });
            if (!entries.length) {
              setLocalError(
                "Crea un objetivo o define tu participación antes de guardar.",
              );
              return;
            }
            void run(() => api("/savings/planner/plans", "PUT", { entries }));
          }}
        >
          <div className="grid-2">
            {plan.goals.map((g: Row) => (
              <div
                key={g.id}
                style={{
                  borderBottom: "1px solid #e2e8f0",
                  padding: "16px 0",
                  minWidth: 0,
                }}
              >
                <h3>{g.name}</h3>
                <p className="detail">
                  Fecha límite: {g.deadline} · Tu responsabilidad:{" "}
                  {g.percentage == null ? "sin definir" : `${g.percentage}%`} ·
                  Pendiente: {formatMoney(g.remaining, currency)}
                </p>
                <label>
                  Aporte pendiente para {g.name}
                  <input
                    aria-label={`Aporte pendiente para ${g.name}`}
                    type="number"
                    min="0"
                    max={g.remaining}
                    step="0.01"
                    disabled={
                      g.participationMissing ||
                      g.status === "completed" ||
                      g.deadline.slice(0, 7) < selected ||
                      g.status === "overdue"
                    }
                    value={draft[g.id] ?? "0"}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [g.id]: e.target.value }))
                    }
                  />
                </label>
                {g.space_id && (
                  <label
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginTop: 12,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={sharing[g.id] ?? false}
                      onChange={(e) =>
                        setSharing((d) => ({ ...d, [g.id]: e.target.checked }))
                      }
                      style={{ width: "auto" }}
                    />
                    Compartir mi plan de {g.name} con el espacio
                  </label>
                )}
                <p className="detail">
                  {g.participationMissing
                    ? "El administrador debe definir los porcentajes del objetivo."
                    : g.remaining === 0
                      ? "Tu responsabilidad está cubierta."
                      : g.feasible
                        ? `Tu parte se cubriría en ${g.estimatedCompletion} con este presupuesto.`
                        : `Tu parte no se cumple a tiempo: déficit proyectado de ${formatMoney(g.deficit ?? g.remaining, currency)}.`}
                </p>
                <p className="detail">
                  Necesidad mensual: {formatMoney(g.monthlyRequired, currency)}{" "}
                  · Déficit acumulado del plan anterior:{" "}
                  {formatMoney(g.accumulatedDeficit, currency)}.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={g.remaining === 0}
                  onClick={() => onContribute(g)}
                >
                  Registrar aporte real
                </Button>
              </div>
            ))}
          </div>
          <p className="detail" style={{ marginTop: 16 }}>
            Total pendiente editado: {formatMoney(pending, currency)} ·
            Disponible para planificar: {formatMoney(row.budget, currency)} ·
            Sin asignar en la sugerencia:{" "}
            {formatMoney(row.unassigned, currency)}.
          </p>
          <Button disabled={busy}>Guardar planificación de {selected}</Button>
        </form>
      </section>
      {plan.conflicts.length > 0 && (
        <section className="card">
          <h2>Conflictos del plan manual</h2>
          {plan.conflicts.map((c: string, i: number) => (
            <p key={i} role="alert">
              {c}
            </p>
          ))}
        </section>
      )}
      <p className="detail">
        La viabilidad indicada corresponde a tu responsabilidad. El cumplimiento
        global también depende de los aportes de los demás participantes. El
        motor usa importes y vencimientos; no utiliza IA generativa.
      </p>
    </>
  );
}
