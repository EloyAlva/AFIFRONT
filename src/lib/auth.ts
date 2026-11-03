import { API_URL, publicRequest } from "./backend";

export type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email?: string;
    user_metadata?: { display_name?: string };
  };
};
type Event =
  "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED" | "PASSWORD_RECOVERY";
type Listener = (event: Event, session: Session | null) => void;
export const SESSION_KEY = "afi-auth-session-v1";
let client: ReturnType<typeof createAuth> | undefined;

function createAuth() {
  let session: Session | null = null;
  let initialized: Promise<void> | undefined;
  let refresh: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let version = 0;
  const listeners = new Set<Listener>();
  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
      return value?.user?.id &&
        value.access_token &&
        value.refresh_token &&
        Number.isFinite(value.expires_at)
        ? (value as Session)
        : null;
    } catch {
      return null;
    }
  };
  const emit = (event: Event) => listeners.forEach((fn) => fn(event, session));
  const schedule = () => {
    clearTimeout(timer);
    if (session)
      timer = setTimeout(
        () => {
          void renew().catch(() => {});
        },
        Math.max(
          1000,
          Math.min(2147483647, session.expires_at * 1000 - Date.now() - 60000),
        ),
      );
  };
  const save = (next: Session | null, event: Event) => {
    session = next;
    version++;
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_KEY);
    schedule();
    emit(event);
  };
  const renew = (): Promise<void> => {
    if (refresh) return refresh;
    const run = async () => {
      // Serialize refresh across tabs so a rotating refresh token is never used twice.
      session = read();
      if (!session || session.expires_at * 1000 - Date.now() > 60000) {
        schedule();
        return;
      }
      const revision = version;
      const refreshToken = session.refresh_token;
      try {
        const result = await publicRequest<{ session: Session }>(
          "/auth/refresh",
          "POST",
          { refresh_token: refreshToken },
        );
        if (version === revision && read()?.refresh_token === refreshToken)
          save(result.session, "TOKEN_REFRESHED");
      } catch (e) {
        const status = (e as { status?: number }).status;
        if (version !== revision || read()?.refresh_token !== refreshToken)
          return;
        if ([400, 401, 403].includes(status ?? 0)) save(null, "SIGNED_OUT");
        else
          timer = setTimeout(() => {
            void renew().catch(() => {});
          }, 15000);
        throw e;
      }
    };
    refresh = (async () => {
      if (navigator.locks)
        await navigator.locks.request("afi-session-refresh", run);
      else await run();
    })().finally(() => {
      refresh = undefined;
    });
    return refresh;
  };
  const initialize = () =>
    (initialized ??= (async () => {
      session = read();
      window.addEventListener("storage", (e) => {
        if (e.key === SESSION_KEY || e.key === null) {
          session = read();
          version++;
          schedule();
          emit(session ? "SIGNED_IN" : "SIGNED_OUT");
        }
      });
      window.addEventListener("focus", () => {
        void renew().catch(() => {});
      });
      const hash = new URLSearchParams(window.location.hash.slice(1));
      if (hash.has("access_token") || hash.has("refresh_token")) {
        // Remove credentials from history immediately, including on failed verification.
        window.history.replaceState(
          {},
          "",
          window.location.pathname + window.location.search,
        );
        try {
          const result = await publicRequest<{ session: Session }>(
            "/auth/session",
            "POST",
            {
              access_token: hash.get("access_token") ?? "",
              refresh_token: hash.get("refresh_token") ?? "",
            },
          );
          save(
            result.session,
            hash.get("type") === "recovery" ? "PASSWORD_RECOVERY" : "SIGNED_IN",
          );
        } catch {
          save(null, "SIGNED_OUT");
          throw Error(
            "El enlace de acceso no es válido o venció. Solicita uno nuevo.",
          );
        }
      } else if (session) await renew();
      schedule();
    })().catch((error) => {
      initialized = Promise.resolve();
      throw error;
    }));
  const getSession = async () => {
    try {
      await initialize();
      if (session && session.expires_at * 1000 - Date.now() <= 60000)
        await renew();
      return { data: { session }, error: null };
    } catch (e) {
      return { data: { session: null }, error: e as Error };
    }
  };
  const attempt = async <T>(run: () => Promise<T>) => {
    try {
      return { ...(await run()), error: null };
    } catch (e) {
      return { error: e as Error & { code?: string } };
    }
  };
  const authenticated = async <T>(
    path: string,
    method: string,
    body?: unknown,
  ) => {
    const result = await getSession();
    if (!result.data.session)
      throw result.error ?? Error("Inicia sesión para continuar");
    return publicRequest<T>(
      path,
      method,
      body,
      result.data.session.access_token,
    );
  };
  return {
    auth: {
      getSession,
      onAuthStateChange(fn: Listener) {
        listeners.add(fn);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                listeners.delete(fn);
              },
            },
          },
        };
      },
      signInWithPassword: (p: { email: string; password: string }) =>
        attempt(async () => {
          await initialize();
          const result = await publicRequest<{ session: Session }>(
            "/auth/login",
            "POST",
            p,
          );
          save(result.session, "SIGNED_IN");
          return { data: result };
        }),
      signUp: (p: {
        email: string;
        password: string;
        options: { data: { display_name: string }; emailRedirectTo?: string };
      }) =>
        attempt(async () => {
          await initialize();
          const result = await publicRequest<{ session: Session | null }>(
            "/auth/register",
            "POST",
            {
              email: p.email,
              password: p.password,
              display_name: p.options.data.display_name,
              redirect_to: p.options.emailRedirectTo,
            },
          );
          if (result.session) save(result.session, "SIGNED_IN");
          return { data: result };
        }),
      resetPasswordForEmail: (email: string, options: { redirectTo: string }) =>
        attempt(() =>
          publicRequest("/auth/recover", "POST", {
            email,
            redirect_to: options.redirectTo,
          }),
        ),
      updateUser: (p: {
        password: string;
        current_password?: string;
        nonce?: string;
      }) => attempt(() => authenticated("/auth/password", "PUT", p)),
      reauthenticate: () =>
        attempt(() => authenticated("/auth/reauthenticate", "POST")),
      signOut: () =>
        attempt(async () => {
          const current = session;
          save(null, "SIGNED_OUT");
          if (current)
            await publicRequest(
              "/auth/logout",
              "POST",
              undefined,
              current.access_token,
            );
          return {};
        }),
    },
  };
}
export function auth() {
  if (typeof window === "undefined")
    throw Error("La sesión solo está disponible en el navegador");
  return (client ??= createAuth());
}
export const configured = !!API_URL;
