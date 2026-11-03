"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "./ui/button";
import type { Row } from "./resource-form";

export function RegisteredInvitations({
  spaces,
  goals,
  initial,
  onClose,
  onSent,
}: {
  spaces: Row[];
  goals: Row[];
  initial?: Row;
  onClose: () => void;
  onSent: () => void;
}) {
  const [space, setSpace] = useState(initial?.space_id ?? spaces[0]?.id ?? "");
  const [goal, setGoal] = useState(initial?.goal_id ?? "");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [sent, setSent] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  useEffect(() => {
    let live = true;
    setUsers([]);
    setError("");
    if (!space) return;
    setLoading(true);
    const timer = setTimeout(() => {
      api("/users/search?space_id=" + space + "&q=" + encodeURIComponent(query))
        .then((r) => {
          if (live) setUsers(r.data);
        })
        .catch((e) => {
          if (live) setError(e.message);
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [space, query]);
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      aria-labelledby="invite-title"
      style={{
        width: "min(580px,94vw)",
        maxHeight: "85vh",
        padding: 24,
        borderRadius: 20,
        border: "1px solid var(--border)",
        background: "var(--surface, white)",
        color: "var(--text)",
        margin: "auto",
      }}
    >
      <div className="section-heading">
        <h2 id="invite-title">Invitar usuarios registrados</h2>
        <Button
          variant="ghost"
          onClick={onClose}
          aria-label="Cerrar invitaciones"
        >
          Cerrar
        </Button>
      </div>
      <p className="detail">
        La otra persona recibirá una invitación en AFI. Al aceptar se unirá al
        espacio y podrá ver sus objetivos compartidos.
      </p>
      <label>
        Espacio
        <select
          value={space}
          onChange={(e) => {
            setSpace(e.target.value);
            setGoal("");
          }}
        >
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Objetivo compartido (opcional)
        <select value={goal} onChange={(e) => setGoal(e.target.value)}>
          <option value="">Todo el espacio</option>
          {goals
            .filter((g) => g.space_id === space)
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Buscar por nombre o usuario
        <input
          autoFocus
          maxLength={80}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ej. Marines o mramirez"
        />
      </label>
      {!space && <p>Crea un espacio para poder invitar usuarios.</p>}
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Buscando usuarios…</p>}
      {!loading && space && !users.length && !error && (
        <p>No se encontraron usuarios.</p>
      )}
      <div aria-live="polite">
        {users.map((u) => (
          <div
            key={u.id}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div>
              <strong>{u.display_name || u.username}</strong>
              <p className="detail">{u.username}</p>
            </div>
            <Button
              disabled={!!busy || u.is_member || u.is_invited}
              onClick={async () => {
                setBusy(u.id);
                setError("");
                try {
                  await api("/spaces/" + space + "/invite-user", "POST", {
                    user_id: u.id,
                    goal_id: goal || null,
                  });
                  setUsers((list) =>
                    list.map((x) =>
                      x.id === u.id ? { ...x, is_invited: true } : x,
                    ),
                  );
                  onSent();
                  setSent(true);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy("");
                }
              }}
            >
              {u.is_member
                ? "Ya es miembro"
                : u.is_invited
                  ? "Invitación enviada"
                  : busy === u.id
                    ? "Enviando…"
                    : "Invitar"}
            </Button>
          </div>
        ))}
      </div>
      <div
        style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}
      >
        <Button onClick={onClose}>
          {sent ? "Listo, cerrar" : "Cerrar ventana"}
        </Button>
      </div>
    </dialog>
  );
}

export function InvitationInbox({
  items,
  onRespond,
  busy,
}: {
  items: Row[];
  onRespond: (id: string, accept: boolean) => void;
  busy: boolean;
}) {
  return (
    <section aria-label="Invitaciones recibidas">
      <h2>Invitaciones recibidas</h2>
      {!items.length ? (
        <p className="detail">No tienes invitaciones pendientes.</p>
      ) : (
        items.map((i) => (
          <article
            className="panel"
            key={i.id}
            style={{ padding: 20, marginBottom: 12 }}
          >
            <h3>{i.space_name}</h3>
            <p>
              {i.inviter_name || "Un usuario"} te invita a unirte a este
              espacio.
            </p>
            {i.goal_name && (
              <p>
                Objetivo: <strong>{i.goal_name}</strong>
              </p>
            )}
            <p className="detail">
              Al aceptar podrás ver los objetivos compartidos del espacio. Tus
              cuentas personales siguen siendo privadas.
            </p>
            <div className="toolbar">
              <Button disabled={busy} onClick={() => onRespond(i.id, true)}>
                Aceptar invitación
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => onRespond(i.id, false)}
              >
                Rechazar
              </Button>
            </div>
          </article>
        ))
      )}
    </section>
  );
}
