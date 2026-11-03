"use client";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@/lib/auth";
import { DateTime } from "luxon";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  ArrowLeftRight,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Download,
  Eye,
  Flag,
  FolderHeart,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  api,
  auth,
  configured,
  exportTransactions,
  formatMoney,
} from "@/lib/api";
import { Button } from "./ui/button";
import { SavingsOverview, SavingsPlanner } from "./savings-planner";
import {
  RegisteredInvitations,
  InvitationInbox,
} from "./registered-invitations";
import { ResourceForm, transactionTypes, type Row } from "./resource-form";
import { FinancialAssistant } from "./financial-assistant";
import { CategorySettings } from "./category-settings";
import { normalizeLoginEmail } from "@/lib/login";
import { PasswordForm } from "./password-form";
import { RecoveryCodeForm } from "./recovery-code-form";
import {
  SecurityQuestionSetup,
  SecurityQuestionRecovery,
} from "./security-question";

const nav = [
  { id: "ai", label: "Asistente AFI", icon: Sparkles },
  { id: "dashboard", label: "Resumen general", icon: LayoutDashboard },
  { id: "transactions", label: "Movimientos", icon: ArrowLeftRight },
  { id: "accounts", label: "Mis cuentas", icon: Wallet },
  { id: "cards", label: "Tarjetas de crédito", icon: CreditCard },
  { id: "debts", label: "Préstamos", icon: Landmark },
  { id: "calendar", label: "Pagos y calendario", icon: CalendarDays },
  { id: "budgets", label: "Presupuestos", icon: ChartNoAxesCombined },
  { id: "goals", label: "Objetivos de ahorro", icon: Target },
  { id: "planner", label: "Planificador de ahorro", icon: CalendarDays },
  { id: "spaces", label: "Espacios compartidos", icon: Users },
];
const statuses: Record<string, string> = {
  paid: "Pagado",
  pending: "Pendiente",
  partial: "Parcial",
  overdue: "Vencido",
};
const colors = ["#2563eb", "#0f172a", "#64748b", "#93a9c9", "#cbd5e1"];
function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <ChartNoAxesCombined size={24} />
      </div>
      <div className="brand-text">
        afi<span style={{ color: "#2563eb" }}>.</span>
        <small>ASISTENTE FINANCIERO</small>
      </div>
    </div>
  );
}
function Empty({
  title = "Aún no hay registros",
  text = "Empieza a organizar tus finanzas registrando tus primeros datos.",
  onAdd,
  label = "Crear registro",
}: {
  title?: string;
  text?: string;
  onAdd?: () => void;
  label?: string;
}) {
  return (
    <div className="empty">
      <FolderHeart size={29} />
      <h3>{title}</h3>
      <p>{text}</p>
      {onAdd && (
        <Button variant="outline" onClick={onAdd}>
          <Plus size={15} />
          {label}
        </Button>
      )}
    </div>
  );
}
function Progress({ value }: { value: number }) {
  return (
    <div className="progress">
      <div
        style={{
          width: Math.max(0, Math.min(100, value)) + "%",
          background: value > 100 ? "#dc2626" : undefined,
        }}
      />
    </div>
  );
}
function Stat({
  label,
  value,
  foot,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  foot: string;
  icon: typeof Wallet;
  tone?: string;
}) {
  return (
    <div className="card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">
          <Icon size={16} />
        </span>
      </div>
      <div className={"stat-value " + (tone ?? "")}>{value}</div>
      <div className="stat-foot">{foot}</div>
    </div>
  );
}

function AuthScreen({
  recovery = false,
  onRecovered,
  notice = "",
}: {
  recovery?: boolean;
  onRecovered?: () => void;
  notice?: string;
}) {
  const [mode, setMode] = useState(recovery ? "update" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (recovery) {
      setMode("update");
      setMessage("");
      setPassword("");
    }
  }, [recovery]);
  return (
    <div className="auth-shell">
      <section className="auth-story">
        <Brand />
        <div>
          <small style={{ letterSpacing: 2, color: "#60a5fa" }}>
            CLARIDAD PARA TU DÍA A DÍA
          </small>
          <h1 style={{ marginTop: 20 }}>
            Tu dinero.
            <br />
            Tus metas.
            <br />
            Todo en orden.
          </h1>
          <p>
            Un espacio para entender tus finanzas y construir lo que viene, paso
            a paso.
          </p>
          <div
            className="row"
            style={{ marginTop: 38, color: "#cbd5e1", fontSize: 12 }}
          >
            <ShieldCheck size={18} />
            Tus finanzas personales son privadas.
          </div>
        </div>
        <small>AFI · Asistente Financiero Inteligente</small>
      </section>
      <div className="auth-form-area">
        <div className="auth-form">
          <div className="mobile-only" style={{ marginBottom: 35 }}>
            <Brand />
          </div>
          <h1>
            {mode === "register"
              ? "Crea tu cuenta"
              : mode === "reset"
                ? "Recupera tu acceso"
                : mode === "question"
                  ? "Pregunta de seguridad"
                  : mode === "code"
                    ? "Cambia tu clave"
                    : mode === "update"
                      ? "Nueva contraseña"
                      : "Bienvenido a AFI"}
          </h1>
          <p>
            {mode === "register"
              ? "Da el primer paso hacia unas finanzas más claras."
              : mode === "reset"
                ? "Te enviaremos un enlace para restablecer tu contraseña."
                : mode === "question"
                  ? "Responde tu pregunta y elige una nueva contraseña."
                  : mode === "code"
                    ? "Elige una nueva contraseña usando tu código de recuperación. No necesitas correo."
                    : mode === "update"
                      ? "Elige una contraseña segura para tu cuenta."
                      : "Inicia sesión para ver el panorama completo."}
          </p>
          {!configured ? (
            <div className="config-box">
              <h3>Conecta el backend de AFI</h3>
              <p style={{ margin: "12px 0" }}>
                Copia <code>.env.example</code> a <code>.env.local</code>,
                configura NEXT_PUBLIC_API_URL con la dirección de tu backend y
                reinicia el frontend.
              </p>
              <small>
                No se usan datos ficticios ni credenciales de ejemplo.
              </small>
            </div>
          ) : (
            <>
              {notice && (
                <p role="alert" className="alert-error">
                  {notice}
                </p>
              )}
              {mode === "update" ? (
                <PasswordForm recovery onSuccess={onRecovered} />
              ) : mode === "question" ? (
                <SecurityQuestionRecovery
                  initialUsername={email}
                  onBack={() => setMode("login")}
                  onCode={() => setMode("code")}
                  onSuccess={(username) => {
                    setEmail(username);
                    setPassword("");
                    setMessage(
                      "Contraseña actualizada. Inicia sesión con tu nueva clave.",
                    );
                    setMode("login");
                  }}
                />
              ) : mode === "code" ? (
                <RecoveryCodeForm
                  initialUsername={email}
                  onBack={() => setMode("login")}
                  onEmail={() => setMode("reset")}
                  onSuccess={(username) => {
                    setEmail(username);
                    setPassword("");
                    setMessage(
                      "Contraseña actualizada. Inicia sesión con tu nueva clave.",
                    );
                    setMode("login");
                  }}
                />
              ) : (
                <>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      setMessage("");
                      try {
                        let error;
                        if (mode === "register")
                          ({ error } = await auth().auth.signUp({
                            email,
                            password,
                            options: {
                              data: { display_name: name },
                              emailRedirectTo:
                                window.location.href.split("#")[0],
                            },
                          }));
                        else if (mode === "reset")
                          ({ error } = await auth().auth.resetPasswordForEmail(
                            normalizeLoginEmail(email),
                            { redirectTo: window.location.origin },
                          ));
                        else
                          ({ error } = await auth().auth.signInWithPassword({
                            email: normalizeLoginEmail(email),
                            password,
                          }));
                        if (error) throw error;
                        if (mode === "reset")
                          setMessage(
                            "Si la cuenta existe, recibirás un enlace en el correo vinculado. Revisa también la carpeta de spam.",
                          );
                        if (mode === "register")
                          setMessage(
                            "Cuenta creada. Revisa tu correo para confirmar tu dirección.",
                          );
                      } catch (e) {
                        setMessage((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {mode === "register" && (
                      <label>
                        Nombre
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          maxLength={120}
                          autoComplete="name"
                        />
                      </label>
                    )}
                    {mode !== "update" && (
                      <label>
                        {mode === "register"
                          ? "Correo electrónico"
                          : "Usuario o correo electrónico"}
                        <input
                          type={mode === "register" ? "email" : "text"}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          autoComplete={
                            mode === "register" ? "email" : "username"
                          }
                          autoCapitalize="none"
                          spellCheck={false}
                          placeholder={
                            mode === "register"
                              ? "tu@correo.com"
                              : "mramirez o ealva"
                          }
                        />
                      </label>
                    )}
                    {mode !== "reset" && (
                      <label>
                        Contraseña
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={mode === "register" ? 12 : 8}
                          autoComplete={
                            mode === "login"
                              ? "current-password"
                              : "new-password"
                          }
                          placeholder={
                            mode === "register"
                              ? "Mínimo 12 caracteres"
                              : "Tu contraseña"
                          }
                        />
                      </label>
                    )}
                    {message && (
                      <p className="detail" role="status" style={{ margin: 0 }}>
                        {message}
                      </p>
                    )}
                    <Button disabled={busy}>
                      {busy
                        ? "Procesando…"
                        : mode === "login"
                          ? "Iniciar sesión"
                          : mode === "register"
                            ? "Crear cuenta"
                            : mode === "update"
                              ? "Guardar contraseña"
                              : "Enviar enlace"}
                      <ArrowRight size={16} />
                    </Button>
                  </form>
                  <div className="auth-links">
                    <button
                      onClick={() => {
                        setMode(mode === "login" ? "register" : "login");
                        setMessage("");
                      }}
                    >
                      {mode === "login"
                        ? "Crear una cuenta"
                        : "Volver a iniciar sesión"}
                    </button>
                    {mode === "login" && (
                      <button
                        onClick={() => {
                          setMessage("");
                          setMode("question");
                        }}
                      >
                        Olvidé mi contraseña
                      </button>
                    )}
                  </div>
                  {mode === "reset" && (
                    <p className="detail" style={{ marginTop: 18 }}>
                      Necesitas acceso al correo vinculado para abrir el enlace.
                      Si no tienes acceso, solicita al administrador que
                      restablezca tu contraseña.
                    </p>
                  )}
                </>
              )}
            </>
          )}
          <div
            className="row"
            style={{ marginTop: 40, fontSize: 11, color: "#94a3b8" }}
          >
            <ShieldCheck size={14} />
            Tu información se mantiene bajo tu control.
          </div>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [tab, setTab] = useState("ai");
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [data, setData] = useState<Record<string, Row[]>>({});
  const [summary, setSummary] = useState<Row | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [month, setMonth] = useState(
    DateTime.now().setZone("America/Lima").toFormat("yyyy-MM"),
  );
  const [currency, setCurrency] = useState("PEN");
  const [modal, setModal] = useState<{
    resource: string;
    initial?: Row;
    ai?: boolean;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [calendarView, setCalendarView] = useState(false);
  const [transactionPage, setTransactionPage] = useState(1);
  const [invitePicker, setInvitePicker] = useState<Row | null>(null);
  const [incoming, setIncoming] = useState<Row[]>([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  useEffect(() => {
    setIncoming([]);
    if (!session) return;
    let live = true;
    const refresh = () => {
      api("/invitations/incoming")
        .then((r) => {
          if (live) setIncoming(r.data ?? []);
        })
        .catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [session?.user.id]);
  const respondToInvite = async (id: string, accept: boolean) => {
    setInviteBusy(true);
    try {
      await api("/invitations/" + id + "/respond", "POST", { accept });
      setIncoming((list) => list.filter((i) => i.id !== id));
      notify(accept ? "Te uniste al espacio" : "Invitación rechazada");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInviteBusy(false);
    }
  };
  const [invitation, setInvitation] = useState("");
  const [decisionBusy, setDecisionBusy] = useState(false);
  const money = (v: number) => formatMoney(v ?? 0, currency);
  useEffect(() => {
    if (!configured) {
      setAuthLoading(false);
      return;
    }
    const linkHash = new URLSearchParams(window.location.hash.slice(1));
    if (linkHash.has("error")) {
      setAuthNotice(
        "El enlace de recuperación no es válido o venció. Solicita uno nuevo desde «Olvidé mi contraseña».",
      );
      window.history.replaceState(
        {},
        "",
        window.location.pathname + window.location.search,
      );
    }
    auth()
      .auth.getSession()
      .then(({ data, error }) => {
        if (error) setAuthNotice(error.message);
        setSession(data.session);
        setAuthLoading(false);
      });
    const {
      data: { subscription },
    } = auth().auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT") {
        setData({});
        setSummary(null);
        setTab("ai");
        setMobile(false);
      }
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    setInvitation(
      new URLSearchParams(window.location.search).get("invitation") ?? "",
    );
    return () => subscription.unsubscribe();
  }, []);
  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      await api("/occurrences/generate", "POST", {
        from: month + "-01",
        to: DateTime.fromISO(month + "-01")
          .endOf("month")
          .toISODate(),
      });
      await api("/notifications/refresh", "POST");
      const names = [
        "accounts",
        "categories",
        "transactions",
        "cards",
        "debts",
        "obligations",
        "occurrences",
        "budgets",
        "goals",
        "spaces",
        "members",
        "invitations",
        "allocations",
        "plans",
        "notifications",
        "profile",
        "preferences",
        "ai-usage",
        "goal-members",
        "card-installments",
        "debt-installments",
        "statements",
      ];
      const result = await Promise.all(
        names.map(async (name) => {
          let rows: Row[] = [];
          for (let page = 1; ; page++) {
            const r = await api("/" + name + "?limit=100&page=" + page);
            rows = rows.concat(r.data);
            if (rows.length >= r.total || !r.data.length) break;
          }
          return [name, rows] as const;
        }),
      );
      const records = Object.fromEntries(result);
      setData(records);
      const s = await api(
        "/dashboard?currency=" + currency + "&month=" + month,
      );
      setSummary(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [session, currency, month]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const notify = (s: string) => setToast(s);
  const open = (resource: string, initial?: Row) =>
    setModal({ resource, initial });
  const act = async (path: string, body?: Row, method = "POST") => {
    try {
      await api(path, method, body);
      notify("Cambios guardados");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const navigate = (id: string) => {
    setTab(id);
    setMobile(false);
    setSearch("");
    setFilter("");
    setTransactionPage(1);
  };
  const edit = (resource: string, row: Row) =>
    open(resource, {
      ...row,
      _editId: row.id,
      ...(resource === "transactions"
        ? {
            occurred_at: DateTime.fromISO(row.occurred_at)
              .setZone(profile?.timezone ?? "America/Lima")
              .toFormat("yyyy-MM-dd'T'HH:mm"),
          }
        : {}),
    });
  const saved = (created?: Row) => {
    if (
      created?.resource === "goals" &&
      created.space_id &&
      data.members?.some(
        (m) =>
          m.space_id === created.space_id &&
          m.user_id === session?.user.id &&
          m.role === "admin",
      )
    )
      setInvitePicker({ space_id: created.space_id, goal_id: created.id });
    setModal(null);
    notify("Registro guardado correctamente");
    void load();
  };
  const profile = data.profile?.[0];
  useEffect(() => {
    if (profile?.currency) setCurrency(profile.currency);
  }, [profile?.id, profile?.currency]);
  const firstName = profile?.display_name?.split(" ")[0] ?? "";
  const pay = (o: Row) => {
    const obligation = data.obligations?.find((b) => b.id === o.obligation_id);
    open("transactions", {
      type: obligation?.card_id
        ? "card_payment"
        : obligation?.debt_id
          ? "loan_payment"
          : "obligation_payment",
      amount: o.pending,
      currency: o.currency,
      occurrence_id: o.id,
      card_id: obligation?.card_id,
      debt_id: obligation?.debt_id,
      source_account_id: obligation?.account_id,
      description: "Pago de " + o.name,
    });
  };
  const transactions = (data.transactions ?? []).filter(
    (t) =>
      t.currency === currency &&
      DateTime.fromISO(t.occurred_at)
        .setZone(profile?.timezone ?? "America/Lima")
        .toFormat("yyyy-MM") === month &&
      (!filter || t.type === filter) &&
      (!search || t.description.toLowerCase().includes(search.toLowerCase())),
  );
  const upcoming = (summary?.occurrences ?? [])
    .filter((o: Row) => o.pending > 0)
    .sort((a: Row, b: Row) => a.due_date.localeCompare(b.due_date));
  const txTable = (rows: Row[]) =>
    !rows.length ? (
      <Empty
        title="Sin movimientos en este período"
        text="Registra un ingreso, un gasto o una transferencia para empezar."
        onAdd={() => open("transactions")}
        label="Registrar movimiento"
      />
    ) : (
      <div className="table-wrap">
        <table className="mobile-table">
          <thead>
            <tr>
              <th>Descripción</th>
              <th>Fecha / cuenta</th>
              <th className="amount">Monto</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>
                  <div className="row">
                    <span className="list-icon">
                      {t.type === "income" ? (
                        <ArrowDownLeft size={16} />
                      ) : t.type === "transfer" ? (
                        <ArrowLeftRight size={16} />
                      ) : (
                        <ArrowUpRight size={16} />
                      )}
                    </span>
                    <div>
                      {t.description}
                      <div
                        style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}
                      >
                        {transactionTypes.find(([id]) => id === t.type)?.[1]}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  {DateTime.fromISO(t.occurred_at)
                    .setZone(profile?.timezone ?? "America/Lima")
                    .toFormat("dd MMM yyyy")}
                  <div className="muted" style={{ marginTop: 4, fontSize: 11 }}>
                    {
                      data.accounts?.find(
                        (a) =>
                          a.id ===
                          (t.source_account_id ?? t.destination_account_id),
                      )?.name
                    }
                  </div>
                </td>
                <td
                  className={
                    "amount " + (t.type === "income" ? "positive" : "")
                  }
                  style={{ fontWeight: 600 }}
                >
                  {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}
                  {formatMoney(t.amount, t.currency)}
                </td>
                <td>
                  <span className={"badge " + (t.voided_at ? "" : "paid")}>
                    {t.voided_at ? "Anulado" : "Registrado"}
                  </span>
                </td>
                <td>
                  {!t.voided_at && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => edit("transactions", t)}
                    >
                      Editar
                    </Button>
                  )}
                  {!t.voided_at && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (
                          window.confirm(
                            "¿Anular este movimiento? Se conservará en el historial.",
                          )
                        )
                          void act("/transactions/" + t.id + "/void");
                      }}
                    >
                      Anular
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  const heading = (
    title: string,
    subtitle: string,
    resource?: string,
    label?: string,
  ) => (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {resource && (
        <Button onClick={() => open(resource)}>
          <Plus size={16} />
          {label ?? "Nuevo registro"}
        </Button>
      )}
    </div>
  );
  const period = (
    <div className="toolbar">
      <input
        type="month"
        value={month}
        onChange={(e) => {
          if (e.target.value) setMonth(e.target.value);
        }}
        aria-label="Período"
        className="period-select"
      />
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        aria-label="Moneda"
        className="period-select"
      >
        <option value="PEN">PEN · Soles</option>
        <option value="USD">USD · Dólares</option>
        <option value="EUR">EUR · Euros</option>
      </select>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void load()}
        disabled={loading}
      >
        <RefreshCw size={14} />
        Actualizar
      </Button>
    </div>
  );
  if (authLoading)
    return (
      <div style={{ padding: 50 }}>
        <Brand />
        <p className="muted">Comprobando sesión…</p>
      </div>
    );
  if (!session || recovery)
    return (
      <AuthScreen
        recovery={recovery}
        notice={authNotice}
        onRecovered={() => {
          setRecovery(false);
          setAuthNotice("");
          window.history.replaceState({}, "", window.location.pathname);
          notify("Contraseña actualizada correctamente");
        }}
      />
    );
  return (
    <div className={"app-shell " + (collapsed ? "collapsed" : "")}>
      {mobile && (
        <div className="drawer-backdrop" onClick={() => setMobile(false)} />
      )}
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <Brand />
        <div className="nav-label">MI ESPACIO PERSONAL</div>
        <nav style={{ flex: 1, overflowY: "auto" }}>
          {nav.map(({ id, label, icon: Icon }, index) => (
            <div key={id}>
              {id === "goals" && (
                <div className="nav-label">CONSTRUYE TU FUTURO</div>
              )}
              <button
                aria-label={label}
                className={"nav-item " + (tab === id ? "active" : "")}
                onClick={() => navigate(id)}
              >
                <Icon size={18} />
                <span className="nav-text">{label}</span>
                {id === "ai" && (
                  <span
                    className="badge nav-text"
                    style={{ marginLeft: "auto", fontSize: 9 }}
                  >
                    IA
                  </span>
                )}
              </button>
            </div>
          ))}
        </nav>
        <button
          className={"nav-item " + (tab === "settings" ? "active" : "")}
          onClick={() => navigate("settings")}
        >
          <Settings size={18} />
          <span className="nav-text">Configuración</span>
        </button>
        <button
          className="nav-item desktop-only"
          onClick={() => setCollapsed(!collapsed)}
        >
          <PanelLeftClose size={18} />
          <span className="nav-text">Contraer menú</span>
        </button>
        <div className="sidebar-footer">
          <div className="row">
            <div className="avatar">
              {(firstName || session.user.email || "A")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="profile-text" style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {profile?.display_name || "Mi cuenta"}
              </div>
              <small>Espacio personal</small>
            </div>
            <button
              className="button button-ghost button-icon"
              aria-label="Cerrar sesión"
              onClick={() =>
                void auth()
                  .auth.signOut()
                  .catch((e) => setError(e.message))
              }
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <header className="header">
        <div className="row">
          <Button
            className="mobile-only"
            variant="ghost"
            size="icon"
            aria-label="Abrir menú"
            onClick={() => setMobile(true)}
          >
            <Menu size={20} />
          </Button>
          <span className="header-title">
            Mi espacio{" "}
            <span style={{ color: "#cbd5e1", margin: "0 10px" }}>/</span>
            <span style={{ color: "#0f172a" }}>
              {nav.find((n) => n.id === tab)?.label ??
                (tab === "notifications" ? "Notificaciones" : "Configuración")}
            </span>
          </span>
        </div>
        <div className="header-right">
          <small>
            {DateTime.now()
              .setZone(profile?.timezone ?? "America/Lima")
              .setLocale("es")
              .toFormat("ccc, d 'de' MMM")}
          </small>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notificaciones"
            onClick={() => navigate("notifications")}
          >
            <Bell size={18} />
            {(incoming.length > 0 ||
              data.notifications?.some((n) => !n.read_at)) && (
              <span
                className="dot"
                style={{ width: 5, height: 5, marginLeft: -12, marginTop: -14 }}
              />
            )}
          </Button>
          <div className="avatar desktop-only">
            {(firstName || "AF").slice(0, 2).toUpperCase()}
          </div>
        </div>
      </header>
      <main className="main">
        {incoming.length > 0 && tab !== "notifications" && tab !== "spaces" && (
          <div className="callout" role="status">
            Tienes {incoming.length} invitación(es) pendiente(s).{" "}
            <Button variant="outline" onClick={() => navigate("notifications")}>
              Revisar invitaciones
            </Button>
          </div>
        )}
        {(tab === "notifications" || tab === "spaces") && (
          <InvitationInbox
            items={incoming}
            busy={inviteBusy}
            onRespond={(id, accept) => void respondToInvite(id, accept)}
          />
        )}
        {error && (
          <div className="alert-error" role="alert">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError("")}
                aria-label="Cerrar aviso"
              >
                <X size={16} />
              </Button>
            </div>
          </div>
        )}
        {invitation && (
          <div className="callout">
            <Users size={19} />
            <div style={{ flex: 1 }}>
              <h3>Tienes una invitación a un espacio compartido</h3>
              <p>
                Solo se compartirán objetivos y aportes. Tus cuentas seguirán
                siendo privadas.
              </p>
              <div className="space-actions">
                <Button
                  size="sm"
                  disabled={decisionBusy}
                  onClick={async () => {
                    setDecisionBusy(true);
                    try {
                      await api("/invitations/respond", "POST", {
                        token: invitation,
                        accept: true,
                      });
                      setInvitation("");
                      window.history.replaceState(
                        {},
                        "",
                        window.location.pathname,
                      );
                      notify("Te uniste al espacio");
                      await load();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setDecisionBusy(false);
                    }
                  }}
                >
                  Aceptar invitación
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await api("/invitations/respond", "POST", {
                        token: invitation,
                        accept: false,
                      });
                      setInvitation("");
                      window.history.replaceState(
                        {},
                        "",
                        window.location.pathname,
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Rechazar
                </Button>
              </div>
            </div>
          </div>
        )}

        {tab === "dashboard" && (
          <>
            {heading(
              firstName ? `Hola, ${firstName} 👋` : "Tu resumen financiero",
              "Cada decisión cuenta. Aquí tienes el panorama de tus finanzas.",
              "transactions",
              "Registrar movimiento",
            )}
            {period}
            {loading && !summary ? (
              <div className="stats">
                {[1, 2, 3, 4].map((i) => (
                  <div className="skeleton skeleton-card" key={i} />
                ))}
              </div>
            ) : (
              summary && (
                <>
                  <div className="stats">
                    <Stat
                      label="Dinero disponible"
                      value={money(summary.liquidity)}
                      foot="Saldo propio menos ahorro reservado"
                      icon={Wallet}
                    />
                    <Stat
                      label="Ingresos del mes"
                      value={money(summary.income)}
                      foot={`Hoy: ${money(summary.dayIncome)}`}
                      icon={TrendingUp}
                      tone="positive"
                    />
                    <Stat
                      label="Gastos del mes"
                      value={money(summary.expense)}
                      foot={`Gastos hormiga: ${money(summary.antExpenses)}`}
                      icon={ArrowUpRight}
                    />
                    <Stat
                      label="Ahorro reservado"
                      value={money(summary.reserved)}
                      foot={`${money(summary.unallocated)} sin asignar a metas`}
                      icon={Target}
                    />
                    <Stat
                      label="Ahorro del mes / ingresos"
                      value={
                        summary.savingsIndicator?.actualPercentage == null
                          ? "Sin ingresos"
                          : `${summary.savingsIndicator.actualPercentage.toFixed(1)}%`
                      }
                      foot={`Meta: ${summary.savingsIndicator?.targetPercentage ?? 20}% · Falta ${money(summary.savingsIndicator?.shortfall)}`}
                      icon={Target}
                      tone={
                        summary.savingsIndicator?.status === "behind"
                          ? "negative"
                          : "positive"
                      }
                    />
                  </div>
                  {summary.savingsIndicator && (
                    <div className="callout">
                      <Target size={19} />
                      <div>
                        <h3>Meta de ahorro de {month}</h3>
                        <p>
                          Del primer al último día del mes: reserva el{" "}
                          {summary.savingsIndicator.targetPercentage}% de tus
                          ingresos registrados (
                          {money(summary.savingsIndicator.target)}). Llevas{" "}
                          {money(summary.savingsIndicator.saved)} de ahorro neto
                          este mes.
                        </p>
                        <p>
                          {summary.savingsIndicator.status === "no_income"
                            ? "Registra ingresos para calcular la meta."
                            : summary.savingsIndicator.status === "behind"
                              ? `Alerta: te faltan ${money(summary.savingsIndicator.shortfall)} para alcanzar tu meta de ahorro.`
                              : "Has alcanzado tu meta de ahorro con los ingresos registrados."}
                        </p>
                        <small>
                          Los retiros reducen el ahorro del mes. La meta se
                          actualiza con cada ingreso. Puedes cambiar el
                          porcentaje en Configuración.
                        </small>
                        <Progress
                          value={summary.savingsIndicator.progress ?? 0}
                        />
                      </div>
                    </div>
                  )}
                  <div className="callout">
                    <ShieldCheck size={19} />
                    <div>
                      <h3>
                        {upcoming.length
                          ? `Tienes ${upcoming.length} ${upcoming.length === 1 ? "pago pendiente" : "pagos pendientes"}`
                          : "Tu próximo paso, con claridad"}
                      </h3>
                      <p>
                        {upcoming.length
                          ? `El próximo es ${upcoming[0].name}: ${money(upcoming[0].pending)}, con vencimiento el ${DateTime.fromISO(upcoming[0].due_date).toFormat("dd/MM")}.`
                          : "Registra tus obligaciones para anticipar vencimientos y saber cuánto necesitas reservar."}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="desktop-only"
                      onClick={() => navigate("calendar")}
                      style={{ marginLeft: "auto", color: "#2563eb" }}
                    >
                      Ver pagos
                      <ArrowRight size={14} />
                    </Button>
                  </div>
                  <div className="dashboard-grid">
                    <section className="card">
                      <div className="card-head">
                        <div>
                          <h2>Ingresos y gastos</h2>
                          <p>La evolución de tus últimos seis meses</p>
                        </div>
                        <div className="legend">
                          <span>
                            <i className="dot" />
                            Ingresos
                          </span>
                          <span>
                            <i
                              className="dot"
                              style={{ background: "#cbd5e1" }}
                            />
                            Gastos
                          </span>
                        </div>
                      </div>
                      <div className="chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={summary.evolution}
                            margin={{ left: -18, right: 8, top: 8, bottom: 0 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                              stroke="#e2e8f0"
                            />
                            <XAxis
                              dataKey="month"
                              axisLine={false}
                              tickLine={false}
                              fontSize={10}
                              tickFormatter={(v) =>
                                DateTime.fromISO(v + "-01")
                                  .setLocale("es")
                                  .toFormat("MMM")
                              }
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              fontSize={10}
                            />
                            <Tooltip
                              formatter={(value) => money(Number(value))}
                            />
                            <Area
                              type="monotone"
                              dataKey="income"
                              name="Ingresos"
                              stroke="#2563eb"
                              fill="#eff6ff"
                              strokeWidth={2}
                            />
                            <Area
                              type="monotone"
                              dataKey="expense"
                              name="Gastos"
                              stroke="#94a3b8"
                              fill="#f8fafc"
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </section>
                    <section className="card">
                      <div className="card-head">
                        <div>
                          <h2>¿En qué estás gastando?</h2>
                          <p>Distribución por categoría</p>
                        </div>
                      </div>
                      {summary.categoryTotals.some((c: Row) => c.amount > 0) ? (
                        <>
                          <div style={{ height: 160 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={summary.categoryTotals.filter(
                                    (c: Row) => c.amount > 0,
                                  )}
                                  dataKey="amount"
                                  nameKey="name"
                                  innerRadius={48}
                                  outerRadius={70}
                                  paddingAngle={3}
                                  stroke="none"
                                >
                                  {summary.categoryTotals
                                    .filter((c: Row) => c.amount > 0)
                                    .map((c: Row, i: number) => (
                                      <Cell
                                        key={c.id}
                                        fill={colors[i % colors.length]}
                                      />
                                    ))}
                                </Pie>
                                <Tooltip
                                  formatter={(value) => money(Number(value))}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          {summary.categoryTotals
                            .filter((c: Row) => c.amount > 0)
                            .slice(0, 3)
                            .map((c: Row, i: number) => (
                              <div
                                className="row"
                                style={{
                                  justifyContent: "space-between",
                                  fontSize: 11,
                                  marginTop: 9,
                                }}
                                key={c.id}
                              >
                                <span>
                                  <i
                                    className="dot"
                                    style={{
                                      background: colors[i % colors.length],
                                    }}
                                  />
                                  {c.name}
                                </span>
                                <strong>{money(c.amount)}</strong>
                              </div>
                            ))}
                        </>
                      ) : (
                        <Empty
                          title="Tu distribución aparecerá aquí"
                          text="Los gastos se agruparán por categoría."
                        />
                      )}
                    </section>
                  </div>
                  <div className="dashboard-grid">
                    <section className="card table-card">
                      <div className="card-head">
                        <div>
                          <h2>Últimos movimientos</h2>
                          <p>Un registro claro de tu día a día</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate("transactions")}
                        >
                          Ver todos
                          <ArrowRight size={13} />
                        </Button>
                      </div>
                      {txTable(transactions.slice(0, 5))}
                    </section>
                    <section className="card">
                      <div className="card-head">
                        <div>
                          <h2>Tus objetivos</h2>
                          <p>Acércate a lo que te importa</p>
                        </div>
                        <Flag size={18} color="#94a3b8" />
                      </div>
                      {summary.goals.length ? (
                        summary.goals.slice(0, 3).map((g: Row) => (
                          <div key={g.id} style={{ marginBottom: 25 }}>
                            <div
                              className="row"
                              style={{
                                justifyContent: "space-between",
                                fontSize: 12,
                              }}
                            >
                              <strong>{g.name}</strong>
                              <small>{Math.round(g.progress)}%</small>
                            </div>
                            <Progress value={g.progress} />
                            <div
                              className="row"
                              style={{
                                justifyContent: "space-between",
                                fontSize: 10,
                                color: "#64748b",
                                marginTop: 9,
                              }}
                            >
                              <span>{money(g.confirmed)}</span>
                              <span>de {money(g.ideal_amount)}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <Empty
                          title="Dale un propósito a tu ahorro"
                          text="Crea tu primera meta personal o compartida."
                          onAdd={() => open("goals")}
                          label="Crear objetivo"
                        />
                      )}
                    </section>
                  </div>
                </>
              )
            )}
          </>
        )}

        {tab === "transactions" && (
          <>
            {heading(
              "Movimientos",
              "Todos tus ingresos, gastos y transferencias, en un solo lugar.",
              "transactions",
              "Registrar movimiento",
            )}
            {period}
            <div className="toolbar">
              <div className="row">
                <Search size={16} color="#64748b" />
                <input
                  placeholder="Buscar descripción…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setTransactionPage(1);
                  }}
                  aria-label="Buscar movimientos"
                />
              </div>
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setTransactionPage(1);
                }}
                aria-label="Tipo de movimiento"
              >
                <option value="">Todos los tipos</option>
                {transactionTypes.map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                onClick={() =>
                  void exportTransactions().catch((e) => setError(e.message))
                }
              >
                <Download size={15} />
                Exportar CSV
              </Button>
              <Button variant="outline" onClick={() => open("categories")}>
                Nueva categoría
              </Button>
            </div>
            <div className="card table-card">
              {txTable(
                transactions.slice(
                  (transactionPage - 1) * 20,
                  transactionPage * 20,
                ),
              )}
            </div>
            <div
              className="row"
              style={{ justifyContent: "space-between", marginTop: 20 }}
            >
              <small>{transactions.length} movimientos</small>
              <div className="row">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={transactionPage <= 1}
                  onClick={() => setTransactionPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <small>{transactionPage}</small>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={transactionPage * 20 >= transactions.length}
                  onClick={() => setTransactionPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}

        {tab === "accounts" && (
          <>
            {heading(
              "Mis cuentas",
              "Tu dinero, organizado. Los saldos iniciales no cuentan como ingresos.",
              "accounts",
              "Agregar cuenta",
            )}
            {period}
            <div className="grid-3">
              {summary?.accounts.map((a: Row) => (
                <section className="card" key={a.id}>
                  <div
                    className="row"
                    style={{ justifyContent: "space-between" }}
                  >
                    <span className="list-icon">
                      <Wallet size={19} />
                    </span>
                    <span className="badge">
                      {a.type === "bank"
                        ? "Bancaria"
                        : a.type === "wallet"
                          ? "Billetera"
                          : a.type === "cash"
                            ? "Efectivo"
                            : a.type === "savings"
                              ? "Ahorro"
                              : "Otra"}
                    </span>
                  </div>
                  <div
                    className="row"
                    style={{ justifyContent: "space-between", marginTop: 22 }}
                  >
                    <h2>{a.name}</h2>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => edit("accounts", a)}
                    >
                      Editar
                    </Button>
                  </div>
                  <div className="stat-value" style={{ marginTop: 8 }}>
                    {money(a.balance)}
                  </div>
                  <small>Saldo calculado · {a.currency}</small>
                  <div className="divider" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      open("transactions", {
                        source_account_id: a.id,
                        currency: a.currency,
                      })
                    }
                  >
                    <Plus size={14} />
                    Registrar movimiento
                  </Button>
                </section>
              ))}
            </div>
            {!summary?.accounts.length && (
              <div className="card">
                <Empty
                  title="¿Dónde guardas tu dinero?"
                  text="Agrega tu efectivo, cuenta bancaria o billetera digital."
                  onAdd={() => open("accounts")}
                  label="Agregar cuenta"
                />
              </div>
            )}
          </>
        )}

        {tab === "cards" && (
          <>
            {heading(
              "Tarjetas de crédito",
              "Distingue lo que debes de lo que tienes disponible.",
              "cards",
              "Agregar tarjeta",
            )}
            {period}
            {summary && (
              <div className="stats">
                <Stat
                  label="Línea total"
                  value={money(summary.creditLimit)}
                  foot="Crédito de todas tus tarjetas"
                  icon={CreditCard}
                />
                <Stat
                  label="Crédito utilizado"
                  value={money(summary.creditUsed)}
                  foot="Incluye compras en cuotas"
                  icon={ChartNoAxesCombined}
                />
                <Stat
                  label="Crédito disponible"
                  value={money(summary.creditAvailable)}
                  foot="No forma parte de tu dinero propio"
                  icon={Wallet}
                />
                <Stat
                  label="Deuda total"
                  value={money(summary.debtTotal)}
                  foot="Tarjetas y préstamos, sin duplicar pagos"
                  icon={Landmark}
                />
              </div>
            )}
            <div className="toolbar">
              <Button variant="outline" onClick={() => open("statements")}>
                Registrar estado bancario
              </Button>
              <Button variant="outline" onClick={() => open("purchases")}>
                <Plus size={15} />
                Registrar compra / comisión / devolución
              </Button>
            </div>
            <div className="grid-3">
              {summary?.cards.map((c: Row) => (
                <section className="card credit-card" key={c.id}>
                  <div
                    className="row"
                    style={{ justifyContent: "space-between" }}
                  >
                    <small className="muted">{c.bank}</small>
                    <CreditCard size={22} />
                  </div>
                  <div
                    className="row"
                    style={{ justifyContent: "space-between", marginTop: 17 }}
                  >
                    <h2>{c.name}</h2>
                    <Button
                      size="sm"
                      variant="ghost"
                      style={{ color: "white" }}
                      onClick={() => edit("cards", c)}
                    >
                      Editar
                    </Button>
                  </div>
                  <div className="card-number">•••• •••• ••••</div>
                  <small className="muted">Deuda total</small>
                  <div className="stat-value">{money(c.used)}</div>
                  <Progress value={c.utilization} />
                  <div
                    className="row"
                    style={{
                      justifyContent: "space-between",
                      marginTop: 10,
                      fontSize: 11,
                    }}
                  >
                    <span>{c.utilization.toFixed(1)}% utilizado</span>
                    <span>Meta: ≤ {c.utilization_limit}%</span>
                  </div>
                  <div className="divider" style={{ background: "#334155" }} />
                  <div className="detail" style={{ color: "#cbd5e1" }}>
                    Disponible: {money(c.available)}
                    <br />
                    Cierre: día {c.closing_day} · Pago: día {c.due_day}
                  </div>
                  <div className="space-actions">
                    <Button
                      size="sm"
                      onClick={() =>
                        open("transactions", {
                          type: "card_payment",
                          card_id: c.id,
                          currency: c.currency,
                          description: "Pago de " + c.name,
                        })
                      }
                    >
                      Registrar pago
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      style={{ color: "#0f172a" }}
                      onClick={() => open("purchases", { card_id: c.id })}
                    >
                      Compra
                    </Button>
                  </div>
                </section>
              ))}
            </div>
            {!summary?.cards.length && (
              <div className="card">
                <Empty
                  title="Tus tarjetas, bajo control"
                  text="Registra tu línea y deuda inicial para ver tu utilización real."
                  onAdd={() => open("cards")}
                  label="Agregar tarjeta"
                />
              </div>
            )}
            <div className="card" style={{ marginTop: 22 }}>
              <h2>Estados de cuenta</h2>
              {data.statements?.map((st) => (
                <div className="list-row" key={st.id}>
                  <div>
                    <h3>
                      {data.cards?.find((c) => c.id === st.card_id)?.name} /{" "}
                      {String(st.period).slice(0, 7)}
                    </h3>
                    <p>
                      Vence: {st.due_date} / Mínimo: {money(st.minimum_payment)}
                    </p>
                  </div>
                  <strong>{money(st.amount)}</strong>
                </div>
              ))}
            </div>
            <div className="card" style={{ marginTop: 22 }}>
              <h2>Cuotas de tarjetas</h2>
              {data["card-installments"]?.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Vencimiento</th>
                        <th>Cuota</th>
                        <th className="amount">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data["card-installments"].map((i) => (
                        <tr key={i.id}>
                          <td>{i.due_date}</td>
                          <td>{i.number}</td>
                          <td className="amount">{money(i.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="detail" style={{ marginTop: 14 }}>
                  Las compras generan cuotas. El importe exigible y el pago
                  mínimo se registran desde tu estado bancario en Pagos; el pago
                  mínimo no cancela la deuda total.
                </p>
              )}
            </div>
          </>
        )}

        {tab === "debts" && (
          <>
            {heading(
              "Préstamos",
              "Una vista clara de tus compromisos y saldos pendientes.",
              "debts",
              "Agregar préstamo",
            )}
            {period}
            <div className="callout">
              <CircleHelp size={18} />
              <p>
                El cronograma usa amortización de capital constante e interés
                nominal anual sobre saldo. Registra las obligaciones según tu
                contrato para gestionar los vencimientos de pago.
              </p>
            </div>
            <div className="grid-3">
              {summary?.debts.map((d: Row) => (
                <section className="card" key={d.id}>
                  <div
                    className="row"
                    style={{ justifyContent: "space-between" }}
                  >
                    <span className="list-icon">
                      <Landmark size={18} />
                    </span>
                    <span className="badge">{d.installments} cuotas</span>
                  </div>
                  <div
                    className="row"
                    style={{ justifyContent: "space-between", marginTop: 20 }}
                  >
                    <h2>{d.name}</h2>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => edit("debts", d)}
                    >
                      Editar
                    </Button>
                  </div>
                  <p className="detail">{d.creditor}</p>
                  <small>Saldo pendiente con interés programado</small>
                  <div className="stat-value" style={{ marginTop: 6 }}>
                    {money(d.pending)}
                  </div>
                  <Progress
                    value={
                      (1 -
                        d.pending /
                          (Number(d.principal) +
                            data["debt-installments"]
                              ?.filter((i) => i.debt_id === d.id)
                              .reduce((a, i) => a + Number(i.interest), 0))) *
                      100
                    }
                  />
                  <p className="detail" style={{ marginTop: 12 }}>
                    Capital: {money(d.principal)} · Interés nominal anual:{" "}
                    {d.annual_interest}%
                  </p>
                  <div className="space-actions">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void act("/debts/" + d.id + "/schedule")}
                    >
                      Integrar calendario
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    style={{ marginTop: 17 }}
                    onClick={() =>
                      open("transactions", {
                        type: "loan_payment",
                        debt_id: d.id,
                        currency: d.currency,
                        description: "Pago de " + d.name,
                      })
                    }
                  >
                    Registrar abono
                  </Button>
                </section>
              ))}
            </div>
            {!summary?.debts.length && (
              <div className="card">
                <Empty
                  title="Sin préstamos registrados"
                  onAdd={() => open("debts")}
                  label="Agregar préstamo"
                />
              </div>
            )}
          </>
        )}

        {tab === "calendar" && (
          <>
            {heading(
              "Pagos y calendario",
              "Anticípate a tus vencimientos y registra cada abono.",
              "obligations",
              "Nueva obligación",
            )}
            {period}
            <div className="stats">
              <Stat
                label="Exigible del mes"
                value={money(summary?.payments.due)}
                foot="Importe de los vencimientos"
                icon={CalendarDays}
              />
              <Stat
                label="Ya pagaste"
                value={money(summary?.payments.paid)}
                foot={`${(summary?.payments.covered ?? 0).toFixed(0)}% cubierto`}
                icon={Check}
                tone="positive"
              />
              <Stat
                label="Falta pagar"
                value={money(summary?.payments.pending)}
                foot="Incluye pagos parciales"
                icon={Wallet}
              />
              <Stat
                label="Importe vencido"
                value={money(summary?.payments.overdue)}
                foot="Pendiente después del vencimiento"
                icon={Bell}
                tone={summary?.payments.overdue ? "negative" : undefined}
              />
            </div>
            {summary?.paymentAssistant && (
              <div className="callout">
                <CalendarDays size={18} />
                <div>
                  <h3>Tus próximos pagos</h3>
                  <p>
                    Hoy: {summary.paymentAssistant.today} · Mañana:{" "}
                    {summary.paymentAssistant.tomorrow} · Próximos 7 días:{" "}
                    {summary.paymentAssistant.next7Days}. Necesitas{" "}
                    {money(summary.paymentAssistant.neededNext7Days)} para los
                    próximos vencimientos y atrasos.
                  </p>
                </div>
              </div>
            )}
            <div className="toolbar">
              <Button
                variant={calendarView ? "outline" : "default"}
                onClick={() => setCalendarView(false)}
              >
                Lista
              </Button>
              <Button
                variant={calendarView ? "default" : "outline"}
                onClick={() => setCalendarView(true)}
              >
                <CalendarDays size={15} />
                Calendario
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  void act("/occurrences/generate", {
                    from: month + "-01",
                    to: DateTime.fromISO(month + "-01")
                      .endOf("month")
                      .toISODate(),
                  })
                }
              >
                <RefreshCw size={15} />
                Generar vencimientos del mes
              </Button>
              <Button
                variant="outline"
                onClick={() => void act("/notifications/refresh")}
              >
                Actualizar alertas
              </Button>
            </div>
            {calendarView ? (
              <div className="card">
                <div className="calendar">
                  {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(
                    (d) => (
                      <div className="calendar-label" key={d}>
                        {d}
                      </div>
                    ),
                  )}
                  {Array.from({ length: 42 }, (_, i) => {
                    const date = DateTime.fromISO(month + "-01")
                      .startOf("week")
                      .plus({ days: i });
                    const items =
                      summary?.occurrences.filter(
                        (o: Row) => o.due_date === date.toISODate(),
                      ) ?? [];
                    return (
                      <div
                        key={i}
                        className={
                          "calendar-day " +
                          (date.toFormat("yyyy-MM") !== month ? "dim" : "")
                        }
                      >
                        <span>{date.day}</span>
                        {items.map((o: Row) => (
                          <button
                            className="calendar-event"
                            key={o.id}
                            title={o.name + " · " + money(o.pending)}
                            aria-label={
                              o.name +
                              " " +
                              statuses[o.status] +
                              " " +
                              money(o.pending)
                            }
                            onClick={() => {
                              if (o.pending > 0) pay(o);
                              else notify("Este vencimiento ya está pagado");
                            }}
                          >
                            {o.name}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="card">
                {summary?.occurrences.filter((o: Row) =>
                  o.due_date.startsWith(month),
                ).length ? (
                  summary.occurrences
                    .filter((o: Row) => o.due_date.startsWith(month))
                    .map((o: Row) => (
                      <div className="list-row" key={o.id}>
                        <div className="row">
                          <span className="list-icon">
                            <CalendarDays size={17} />
                          </span>
                          <div>
                            <h3>{o.name}</h3>
                            <p>
                              {DateTime.fromISO(o.due_date)
                                .setLocale("es")
                                .toFormat("d 'de' MMMM")}{" "}
                              · Pagado {money(o.paid)} de {money(o.amount)}
                            </p>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <strong style={{ fontSize: 13 }}>
                            {money(o.pending)}
                          </strong>
                          <div style={{ marginTop: 5 }}>
                            <span className={"badge " + o.status}>
                              {statuses[o.status]}
                            </span>
                          </div>
                          {o.pending > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => pay(o)}
                            >
                              Registrar abono
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => edit("occurrences", o)}
                          >
                            Ajustar período
                          </Button>
                        </div>
                      </div>
                    ))
                ) : (
                  <Empty
                    title="Sin vencimientos en este mes"
                    text="Crea una obligación y genera sus vencimientos por período."
                    onAdd={() => open("obligations")}
                    label="Crear obligación"
                  />
                )}
              </div>
            )}
            <div className="card" style={{ marginTop: 22 }}>
              <h2>Obligaciones configuradas</h2>
              {data.obligations?.map((o) => (
                <div className="list-row" key={o.id}>
                  <div>
                    <h3>{o.name}</h3>
                    <p>
                      {o.frequency === "monthly"
                        ? "Mensual"
                        : o.frequency === "yearly"
                          ? "Anual"
                          : "Una vez"}{" "}
                      · Desde {o.start_date}
                    </p>
                  </div>
                  <strong style={{ fontSize: 13 }}>
                    {formatMoney(o.amount, o.currency)}
                  </strong>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "budgets" && (
          <>
            {heading(
              "Presupuestos",
              "Dale un límite a tus gastos y más espacio a tus objetivos.",
              "budgets",
              "Crear presupuesto",
            )}
            {period}
            <div className="grid-3">
              {summary?.budgets.map((b: Row) => (
                <section className="card" key={b.id}>
                  <div
                    className="row"
                    style={{ justifyContent: "space-between" }}
                  >
                    <h2>
                      {data.categories?.find((c) => c.id === b.category_id)
                        ?.name ?? "Presupuesto general"}
                    </h2>
                    <span
                      className={
                        "badge " +
                        (b.percentage >= 100
                          ? "overdue"
                          : b.alerts?.length
                            ? "partial"
                            : "paid")
                      }
                    >
                      {b.percentage.toFixed(0)}%
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => edit("budgets", b)}
                  >
                    Editar límite
                  </Button>
                  <div className="stat-value" style={{ marginTop: 25 }}>
                    {money(b.spent)}
                  </div>
                  <small>de {money(b.amount)} asignados</small>
                  <Progress value={b.percentage} />
                  <p
                    className={"detail " + (b.remaining < 0 ? "negative" : "")}
                    style={{ marginTop: 15 }}
                  >
                    Restante: {money(b.remaining)}
                    {b.percentage >= 100
                      ? " · Límite alcanzado"
                      : b.alerts?.length
                        ? " · Superaste el " + Math.max(...b.alerts) + "%"
                        : ""}
                  </p>
                </section>
              ))}
            </div>
            {!summary?.budgets.length && (
              <div className="card">
                <Empty
                  title="Planifica tu mes"
                  text="Crea un presupuesto general o por categoría."
                  onAdd={() => open("budgets")}
                  label="Crear presupuesto"
                />
              </div>
            )}
          </>
        )}

        {tab === "goals" && (
          <>
            {heading(
              "Objetivos de ahorro",
              "Planes que se convierten en progreso, aporte a aporte.",
              "goals",
              "Crear objetivo",
            )}
            {period}
            <div className="stats">
              <Stat
                label="Fondo reservado"
                value={money(summary?.reserved)}
                foot="Dinero propio separado para ahorrar"
                icon={Wallet}
              />
              <Stat
                label="Asignado a metas"
                value={money(summary?.allocated)}
                foot="Tus aportes confirmados"
                icon={Target}
              />
              <Stat
                label="Sin asignar"
                value={money(summary?.unallocated)}
                foot="Disponible dentro de tu fondo"
                icon={FolderHeart}
              />
              <Stat
                label="Capacidad estimada"
                value={money(summary?.estimatedSavingCapacity)}
                foot="Estimación conservadora del período"
                icon={TrendingUp}
              />
              <Stat
                label="Meta de ahorro mensual"
                value={money(summary?.savingsIndicator?.target)}
                foot={`${summary?.savingsIndicator?.targetPercentage ?? 20}% de ingresos · Falta ${money(summary?.savingsIndicator?.shortfall)}`}
                icon={Target}
                tone={
                  summary?.savingsIndicator?.status === "behind"
                    ? "negative"
                    : undefined
                }
              />
            </div>
            <div className="toolbar">
              <Button
                variant="outline"
                onClick={() =>
                  open("transactions", {
                    type: "savings_reserve",
                    description: "Reserva de ahorro",
                  })
                }
              >
                <Plus size={15} />
                Reservar ahorro
              </Button>
              <Button variant="outline" onClick={() => open("allocations")}>
                Asignar / retirar aporte
              </Button>
              <Button variant="outline" onClick={() => open("plans")}>
                Planificar ahorro
              </Button>
              <Button variant="outline" onClick={() => open("distribution")}>
                Distribuir por porcentaje
              </Button>
              <Button variant="outline" onClick={() => open("reallocation")}>
                Reasignar entre metas
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  open("transactions", {
                    type: "savings_withdrawal",
                    description: "Retiro de reserva de ahorro",
                  })
                }
              >
                Retirar reserva
              </Button>
            </div>
            <div className="callout">
              <div>
                <h3>Planifica antes de aportar</h3>
                <p>
                  El motor calcula recomendaciones mensuales según fechas,
                  saldos, prioridades, responsabilidades y tu presupuesto
                  privado.
                </p>
                <Button variant="outline" onClick={() => navigate("planner")}>
                  Abrir Planificador de ahorro
                </Button>
              </div>
            </div>
            <SavingsOverview
              mode="goals"
              currency={currency}
              month={month}
              data={data}
              onContribute={(g) => open("allocations", { goal_id: g.id })}
            />
            <div className="grid-3">
              {summary?.goals.map((g: Row) => (
                <section className="card" key={g.id}>
                  <div
                    className="row"
                    style={{ justifyContent: "space-between" }}
                  >
                    <span className="list-icon">
                      <Target size={18} />
                    </span>
                    <span className="badge">
                      {g.space_id ? "Compartido" : "Personal"} ·{" "}
                      {g.priority === 1
                        ? "Alta"
                        : g.priority === 2
                          ? "Media"
                          : "Baja"}
                    </span>
                  </div>
                  <div
                    className="row"
                    style={{ justifyContent: "space-between", marginTop: 20 }}
                  >
                    <h2>{g.name}</h2>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => edit("goals", g)}
                    >
                      Editar
                    </Button>
                  </div>
                  <p className="detail">{g.description}</p>
                  {g.space_id && (
                    <div>
                      <p className="detail">
                        Espacio:{" "}
                        {data.spaces?.find((s) => s.id === g.space_id)?.name}
                      </p>
                      {data.members?.some(
                        (m) =>
                          m.space_id === g.space_id &&
                          m.user_id === session.user.id &&
                          m.role === "admin",
                      ) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            open("participation", { goal_id: g.id })
                          }
                        >
                          Definir aportes por persona
                        </Button>
                      )}
                      {!(data["goal-members"] ?? []).some(
                        (m) => m.goal_id === g.id,
                      ) && (
                        <p className="detail">
                          Participación pendiente de definir (debe sumar 100%).
                        </p>
                      )}
                      {(data["goal-members"] ?? [])
                        .filter((m) => m.goal_id === g.id)
                        .map((m) => {
                          const contributed = (data.allocations ?? [])
                            .filter(
                              (a) =>
                                a.goal_id === g.id && a.user_id === m.user_id,
                            )
                            .reduce((s, a) => s + Number(a.amount), 0);
                          const target = Number(
                            g.participantTargets?.find(
                              (p: Row) => p.user_id === m.user_id,
                            )?.target_amount ??
                              (Number(g.ideal_amount) * Number(m.percentage)) /
                                100,
                          );
                          return (
                            <p className="detail" key={m.user_id}>
                              {m.user_id === session.user.id
                                ? "Tú"
                                : data.members?.find(
                                    (p) =>
                                      p.space_id === g.space_id &&
                                      p.user_id === m.user_id,
                                  )?.display_name || "Participante"}
                              : {m.percentage}% · Meta{" "}
                              {formatMoney(target, g.currency)} · Aportado{" "}
                              {formatMoney(contributed, g.currency)} · Falta{" "}
                              {formatMoney(
                                Math.max(0, target - contributed),
                                g.currency,
                              )}
                            </p>
                          );
                        })}
                    </div>
                  )}
                  <div className="stat-value" style={{ marginTop: 20 }}>
                    {money(g.confirmed)}
                  </div>
                  <small>confirmados de {money(g.ideal_amount)}</small>
                  <Progress value={g.progress} />
                  <div
                    className="row"
                    style={{
                      justifyContent: "space-between",
                      marginTop: 10,
                      fontSize: 11,
                    }}
                  >
                    <span>{g.progress.toFixed(0)}% logrado</span>
                    <span className="muted">{g.target_date}</span>
                  </div>
                  <div className="divider" />
                  <p className="detail">
                    Planificado este mes: {money(g.planned)}
                    <br />
                    Falta para la meta: {money(g.remaining)}
                  </p>
                  {g.space_id &&
                    data.allocations
                      ?.filter((a) => a.goal_id === g.id)
                      .map((a) => a.user_id)
                      .filter((v, i, arr) => arr.indexOf(v) === i)
                      .map((id) => (
                        <p className="detail" key={id}>
                          {id === session.user.id
                            ? "Tú"
                            : data.members?.find((m) => m.user_id === id)
                                ?.display_name || "Participante"}
                          :{" "}
                          {money(
                            data
                              .allocations!.filter(
                                (a) => a.goal_id === g.id && a.user_id === id,
                              )
                              .reduce(
                                (total, a) => total + Number(a.amount),
                                0,
                              ),
                          )}
                        </p>
                      ))}
                  <Button
                    size="sm"
                    variant="outline"
                    style={{ marginTop: 15 }}
                    onClick={() => open("allocations", { goal_id: g.id })}
                  >
                    Registrar aporte
                  </Button>
                </section>
              ))}
            </div>
            {!summary?.goals.length && (
              <div className="card">
                <Empty
                  title="¿Qué te gustaría lograr?"
                  text="Separa lo que planeas ahorrar de lo que ya confirmaste."
                  onAdd={() => open("goals")}
                  label="Crear objetivo"
                />
              </div>
            )}
          </>
        )}

        {tab === "planner" && (
          <>
            {heading(
              "Planificador de ahorro",
              "Presupuestos privados, recomendaciones mensuales y aportes con confirmación.",
              "goals",
              "Crear objetivo",
            )}
            {period}
            <SavingsPlanner
              currency={currency}
              month={month}
              data={data}
              userId={session.user.id}
              onChanged={load}
              onContribute={(g) => open("allocations", { goal_id: g.id })}
            />
          </>
        )}

        {tab === "spaces" && (
          <>
            {heading(
              "Espacios compartidos",
              "Metas en común. Finanzas personales siempre privadas.",
              "spaces",
              "Crear espacio",
            )}
            {period}
            <SavingsOverview
              mode="spaces"
              currency={currency}
              month={month}
              data={data}
              onContribute={(g) => open("allocations", { goal_id: g.id })}
            />
            <div className="callout">
              <ShieldCheck size={19} />
              <p>
                Solo se comparten objetivos, planes y aportes. Ningún miembro
                puede ver tus cuentas, deudas o movimientos personales.
              </p>
            </div>
            <div className="toolbar">
              <Button variant="outline" onClick={() => setInvitePicker({})}>
                <Plus size={15} />
                Invitar usuarios registrados
              </Button>
            </div>
            <div className="grid-2">
              {data.spaces?.map((s) => {
                const members =
                  data.members?.filter((m) => m.space_id === s.id) ?? [];
                const admin = members.some(
                  (m) => m.user_id === session.user.id && m.role === "admin",
                );
                return (
                  <section className="card" key={s.id}>
                    <div className="row">
                      <span className="list-icon">
                        <Users size={19} />
                      </span>
                      <div>
                        <h2>{s.name}</h2>
                        <small>
                          {members.length} participantes ·{" "}
                          {admin ? "Administrador" : "Miembro"}
                        </small>
                      </div>
                    </div>
                    <div className="divider" />
                    {members.map((m) => (
                      <div className="list-row" key={m.user_id}>
                        <div>
                          <h3>
                            {m.user_id === session.user.id
                              ? "Tú"
                              : m.display_name || "Participante"}
                          </h3>
                          <small>
                            {m.role === "admin" ? "Administrador" : "Miembro"}
                          </small>
                        </div>
                        {admin && m.user_id !== s.owner_id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (
                                window.confirm(
                                  "¿Quitar a este miembro del espacio?",
                                )
                              )
                                void act("/spaces/" + s.id + "/manage", {
                                  operation: "remove",
                                  target: m.user_id,
                                });
                            }}
                          >
                            Quitar
                          </Button>
                        )}
                      </div>
                    ))}
                    {data.goals
                      ?.filter((g) => g.space_id === s.id)
                      .map((g) => (
                        <div className="list-row" key={g.id}>
                          <h3>{g.name}</h3>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate("goals")}
                          >
                            Ver objetivo
                          </Button>
                        </div>
                      ))}
                    {admin && (
                      <>
                        <div className="space-actions">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => edit("spaces", s)}
                          >
                            Editar espacio
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `¿Eliminar el espacio «${s.name}»? Se eliminarán sus miembros e invitaciones. Esta acción no se puede deshacer. Los espacios con objetivos asociados no se pueden eliminar.`,
                                )
                              )
                                void act(
                                  "/spaces/" + s.id,
                                  undefined,
                                  "DELETE",
                                );
                            }}
                          >
                            Eliminar espacio
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setInvitePicker({ space_id: s.id })}
                          >
                            Invitar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => open("goals", { space_id: s.id })}
                          >
                            Crear objetivo
                          </Button>
                        </div>
                        {data.invitations
                          ?.filter((i) => i.space_id === s.id)
                          .map((i) => (
                            <div className="list-row" key={i.id}>
                              <p>
                                {i.email}
                                <br />
                                <small>
                                  {i.status} · expira{" "}
                                  {DateTime.fromISO(i.expires_at).toFormat(
                                    "dd/MM",
                                  )}
                                </small>
                              </p>
                              {i.status === "pending" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    void act("/spaces/" + s.id + "/manage", {
                                      operation: "revoke",
                                      target: i.id,
                                    })
                                  }
                                >
                                  Revocar
                                </Button>
                              )}
                            </div>
                          ))}
                      </>
                    )}
                  </section>
                );
              })}
            </div>
            {!data.spaces?.length && (
              <div className="card">
                <Empty
                  title="Avancen juntos hacia una meta"
                  text="Crea un espacio e invita a las personas con las que quieres ahorrar."
                  onAdd={() => open("spaces")}
                  label="Crear espacio"
                />
              </div>
            )}
          </>
        )}

        <div hidden={tab !== "ai"}>
          <FinancialAssistant
            key={session.user.id}
            userId={session.user.id}
            data={data}
            loading={loading}
            onRefresh={() => void load()}
            onManual={() => open("transactions")}
            onAccounts={() => navigate("accounts")}
            onCategories={() => navigate("settings")}
          />
        </div>

        {tab === "notifications" && (
          <>
            {heading(
              "Notificaciones",
              "Recordatorios para anticiparte. Leer una alerta no registra un pago.",
            )}
            <div className="toolbar">
              <Button
                variant="outline"
                onClick={() => void act("/notifications/refresh")}
              >
                <RefreshCw size={15} />
                Actualizar recordatorios
              </Button>
            </div>
            <section className="card">
              {data.notifications?.length ? (
                data.notifications.map((n) => (
                  <div
                    className={
                      "list-row " + (!n.read_at ? "notification-unread" : "")
                    }
                    key={n.id}
                  >
                    <div>
                      <h3>{n.title}</h3>
                      <p>{n.reminder_day}</p>
                    </div>
                    {!n.read_at && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void act("/notifications/" + n.id + "/read")
                        }
                      >
                        <Check size={14} />
                        Leída
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <Empty
                  title="Sin notificaciones"
                  text="Actualiza los recordatorios después de generar tus vencimientos."
                />
              )}
            </section>
          </>
        )}

        {tab === "settings" && (
          <>
            {heading("Configuración", "Personaliza tu experiencia financiera.")}
            <CategorySettings
              categories={(data.categories ?? []).map((c) => ({
                id: c.id,
                name: c.name,
                type: c.type,
              }))}
              onChanged={load}
            />
            <section className="card" style={{ marginTop: 22 }}>
              <h2 style={{ marginBottom: 25 }}>Perfil y preferencias</h2>
              <form
                key={profile?.id}
                className="settings-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  await act(
                    "/profile",
                    {
                      display_name: f.get("display_name"),
                      currency: f.get("currency"),
                      timezone: f.get("timezone"),
                      savings_target_percentage: Number(
                        f.get("savings_target_percentage"),
                      ),
                      ant_expense_threshold: Number(
                        f.get("ant_expense_threshold"),
                      ),
                      budget_thresholds: String(f.get("budget_thresholds"))
                        .split(",")
                        .map(Number),
                    },
                    "PUT",
                  );
                }}
              >
                <label>
                  Nombre
                  <input
                    name="display_name"
                    defaultValue={profile?.display_name}
                    required
                    maxLength={120}
                  />
                </label>
                <label>
                  Moneda principal
                  <select
                    name="currency"
                    defaultValue={profile?.currency ?? "PEN"}
                  >
                    <option value="PEN">PEN · Soles</option>
                    <option value="USD">USD · Dólares</option>
                    <option value="EUR">EUR · Euros</option>
                  </select>
                </label>
                <label>
                  Zona horaria
                  <input
                    name="timezone"
                    defaultValue={profile?.timezone ?? "America/Lima"}
                    required
                    placeholder="America/Lima"
                  />
                </label>
                <label>
                  Umbral de gasto hormiga
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="ant_expense_threshold"
                    defaultValue={
                      data.preferences?.[0]?.ant_expense_threshold ?? 20
                    }
                  />
                </label>
                <label>
                  Meta de ahorro mensual (% de ingresos)
                  <input
                    name="savings_target_percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    required
                    defaultValue={
                      data.preferences?.[0]?.savings_target_percentage ?? 20
                    }
                  />
                </label>
                <label>
                  Umbrales de presupuesto (%)
                  <input
                    name="budget_thresholds"
                    required
                    defaultValue={(
                      data.preferences?.[0]?.budget_thresholds ?? [80, 90, 100]
                    ).join(",")}
                    placeholder="80,90,100"
                  />
                </label>
                <Button style={{ justifySelf: "start" }}>
                  Guardar preferencias
                </Button>
              </form>
            </section>
            <section className="card" style={{ marginTop: 22 }}>
              <h2 style={{ marginBottom: 20 }}>
                Seguridad · Cambiar contraseña
              </h2>
              <PasswordForm />
            </section>
            <section className="card" style={{ marginTop: 22 }}>
              <h2 style={{ marginBottom: 20 }}>Pregunta de seguridad</h2>
              <SecurityQuestionSetup username={session.user.email ?? ""} />
            </section>
          </>
        )}
        {loading && summary && (
          <p className="detail" role="status" style={{ marginTop: 20 }}>
            Actualizando tus datos…
          </p>
        )}
      </main>
      {invitePicker && (
        <RegisteredInvitations
          initial={invitePicker}
          spaces={(data.spaces ?? []).filter((s) =>
            data.members?.some(
              (m) =>
                m.space_id === s.id &&
                m.user_id === session?.user.id &&
                m.role === "admin",
            ),
          )}
          goals={data.goals ?? []}
          onClose={() => setInvitePicker(null)}
          onSent={() => {
            notify("Invitación enviada. Esperando aceptación.");
            // Actualizar solo las invitaciones evita recargar todos los recursos por envío.
            void api("/invitations?limit=100&page=1")
              .then((r) =>
                setData((current) => ({ ...current, invitations: r.data })),
              )
              .catch((e) => setError((e as Error).message));
          }}
        />
      )}
      {modal && (
        <ResourceForm
          key={modal.resource + JSON.stringify(modal.initial)}
          resource={modal.resource}
          initial={modal.initial}
          data={data}
          ai={modal.ai}
          onClose={() => setModal(null)}
          onSaved={saved}
          onError={setError}
        />
      )}{" "}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
