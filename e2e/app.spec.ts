import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("request", (request) => {
    expect(
      new URL(request.url()).hostname,
      "El navegador debe consultar AFIBACK, no Supabase",
    ).not.toMatch(/supabase\.(co|in)$/);
  });
});

test("Auth centralizada: login, persistencia y cierre consultan solo al backend", async ({
  page,
}) => {
  await mock(page);
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  let logins = 0;
  await page.route("http://localhost:4000/api/v1/auth/login", async (r) => {
    logins++;
    expect(r.request().postDataJSON()).toEqual({
      email: "ealva@afi.com",
      password: "LoginPassword.2026!",
    });
    await r.fulfill({
      json: {
        session: {
          access_token: "backend-access",
          refresh_token: "backend-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: uid, email: "ealva@afi.com" },
        },
      },
    });
  });
  await page
    .getByLabel("Usuario o correo electrónico", { exact: true })
    .fill("ealva");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("LoginPassword.2026!");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hablemos de tus finanzas" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hablemos de tus finanzas" }),
  ).toBeVisible();
  expect(logins).toBe(1);
  const logout = page.waitForRequest((r) => r.url().endsWith("/auth/logout"));
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  expect((await logout).headers().authorization).toBe("Bearer backend-access");
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("afi-auth-session-v1")),
    )
    .toBeNull();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
});

test("Auth centralizada: una sola renovación sirve a todas las consultas concurrentes", async ({
  page,
}) => {
  await mock(page);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("afi-auth-session-v1")!);
    s.expires_at = Math.floor(Date.now() / 1000) - 1;
    localStorage.setItem("afi-auth-session-v1", JSON.stringify(s));
  });
  let refreshes = 0;
  await page.route("http://localhost:4000/api/v1/auth/refresh", async (r) => {
    refreshes++;
    expect(r.request().postDataJSON()).toEqual({
      refresh_token: "test-refresh",
    });
    await r.fulfill({
      json: {
        session: {
          access_token: "renewed-access",
          refresh_token: "rotated-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: uid, email: "one@example.com" },
        },
      },
    });
  });
  const request = page.waitForRequest(
    (r) =>
      r.url().includes("/accounts?") &&
      r.headers().authorization === "Bearer renewed-access",
  );
  await page.reload();
  await request;
  await expect(
    page.getByRole("heading", { name: "Hablemos de tus finanzas" }),
  ).toBeVisible();
  expect(refreshes).toBe(1);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("afi-auth-session-v1")!).refresh_token,
    ),
  ).toBe("rotated-refresh");
});

test("Auth centralizada: refresh rechazado cierra la sesión sin consultar finanzas", async ({
  page,
}) => {
  await mock(page);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("afi-auth-session-v1")!);
    s.expires_at = 1;
    localStorage.setItem("afi-auth-session-v1", JSON.stringify(s));
  });
  await page.route("http://localhost:4000/api/v1/auth/refresh", (r) =>
    r.fulfill({
      status: 401,
      json: { error: { code: "bad_refresh_token", message: "Sesión vencida" } },
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("afi-auth-session-v1")),
  ).toBeNull();
});

test("Auth centralizada: registro envía nombre y contraseña al backend", async ({
  page,
}) => {
  await mock(page);
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await page.route("http://localhost:4000/api/v1/auth/register", async (r) => {
    expect(r.request().postDataJSON()).toEqual({
      email: "new@example.com",
      password: "RegisterPassword.2026!",
      display_name: "Nuevo Usuario",
      redirect_to: "http://localhost:3100/",
    });
    await r.fulfill({ json: { session: null } });
  });
  await page
    .getByRole("button", { name: "Crear una cuenta", exact: true })
    .click();
  await page.getByLabel("Nombre", { exact: true }).fill("Nuevo Usuario");
  await page
    .getByLabel("Correo electrónico", { exact: true })
    .fill("new@example.com");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("RegisterPassword.2026!");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(
    page.getByText(
      "Cuenta creada. Revisa tu correo para confirmar tu dirección.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("afi-auth-session-v1")),
  ).toBeNull();
});

test("Invitaciones: buscar usuarios registrados y enviar", async ({ page }) => {
  await mock(page);
  await page.route("http://localhost:4000/api/v1/spaces?**", (r) =>
    r.fulfill({
      json: { data: [{ id: aid, name: "Familia", owner_id: uid }], total: 1 },
    }),
  );
  await page.route("http://localhost:4000/api/v1/members?**", (r) =>
    r.fulfill({
      json: {
        data: [
          { space_id: aid, user_id: uid, role: "admin", display_name: "Eloy" },
        ],
        total: 1,
      },
    }),
  );
  await page.route("http://localhost:4000/api/v1/users/search?**", (r) =>
    r.fulfill({
      json: {
        data: [
          {
            id: gid,
            display_name: "Marines Ramirez",
            username: "mramirez",
            is_member: false,
            is_invited: false,
          },
        ],
      },
    }),
  );
  let sent = false;
  await page.route(
    "http://localhost:4000/api/v1/spaces/" + aid + "/invite-user",
    async (r) => {
      expect(r.request().postDataJSON()).toEqual({
        user_id: gid,
        goal_id: null,
      });
      sent = true;
      await r.fulfill({ json: { id: gid } });
    },
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Espacios compartidos", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Invitar usuarios registrados", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Invitar usuarios registrados",
  });
  await dialog.getByLabel("Buscar por nombre o usuario").fill("Marines");
  await expect(
    dialog.getByText("Marines Ramirez", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Invitar", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Invitación enviada", exact: true }),
  ).toBeDisabled();
  expect(sent).toBe(true);
  await dialog
    .getByRole("button", { name: "Listo, cerrar", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
});

test("Invitaciones recibidas permiten aceptar dentro de AFI", async ({
  page,
}) => {
  await mock(page);
  let accepted = false;
  await page.route("http://localhost:4000/api/v1/invitations/incoming", (r) =>
    r.fulfill({
      json: {
        data: accepted
          ? []
          : [
              {
                id: gid,
                space_id: aid,
                space_name: "Familia",
                inviter_name: "Marines",
                goal_name: "Viaje",
              },
            ],
      },
    }),
  );
  await page.route(
    "http://localhost:4000/api/v1/invitations/" + gid + "/respond",
    async (r) => {
      expect(r.request().postDataJSON()).toEqual({ accept: true });
      accepted = true;
      await r.fulfill({ json: { space_id: aid } });
    },
  );
  await page.reload();
  await page.getByRole("button", { name: "Revisar invitaciones" }).click();
  await expect(
    page
      .getByRole("region", { name: "Invitaciones recibidas" })
      .getByText("Familia"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Aceptar invitación", exact: true })
    .click();
  await expect(
    page.getByText("No tienes invitaciones pendientes."),
  ).toBeVisible();
  expect(accepted).toBe(true);
});

for (const width of [390, 1440])
  test(`Categorías: crear ingresos/egresos, editar y usar en el asistente a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await mock(page);
    const categories = records.categories.map((c) => ({ ...c }));
    let writes = 0;
    await page.route(
      "http://localhost:4000/api/v1/categories**",
      async (route) => {
        const method = route.request().method();
        if (method === "POST") {
          const body = route.request().postDataJSON();
          writes++;
          const created = {
            ...body,
            id: `66666666-6666-4666-8666-${String(writes).padStart(12, "0")}`,
          };
          categories.push(created);
          return route.fulfill({ status: 201, json: { id: created.id } });
        }
        if (method === "PATCH") {
          const body = route.request().postDataJSON();
          expect(body.type).toBeUndefined();
          writes++;
          const id = new URL(route.request().url()).pathname.split("/").at(-1);
          Object.assign(
            categories.find((c) => c.id === id)!,
            body,
          );
          return route.fulfill({ json: { ok: true } });
        }
        return route.fulfill({
          json: {
            data: categories,
            total: categories.length,
            page: 1,
            limit: 100,
          },
        });
      },
    );
    const navigate = async (name: string) => {
      if (width <= 800)
        await page
          .getByRole("button", { name: "Abrir menú", exact: true })
          .click();
      await page.getByRole("button", { name, exact: true }).click();
    };
    await navigate("Configuración");
    const settings = page.getByRole("region", {
      name: "Categorías de ingresos y egresos",
      exact: true,
    });
    await expect(
      settings
        .getByRole("region", { name: "Categorías de ingresos", exact: true })
        .getByText("Sueldo", { exact: true }),
    ).toBeVisible();
    await expect(
      settings
        .getByRole("region", { name: "Categorías de egresos", exact: true })
        .getByText("Alimentación", { exact: true }),
    ).toBeVisible();
    await settings
      .getByRole("button", {
        name: "Agregar categoría de ingreso",
        exact: true,
      })
      .click();
    let form = settings.getByRole("form", {
      name: "Crear categoría",
      exact: true,
    });
    await expect(
      form.getByLabel("Tipo de categoría", { exact: true }),
    ).toHaveValue("income");
    await form
      .getByLabel("Nombre de categoría", { exact: true })
      .fill("Trabajo independiente");
    await form
      .getByRole("button", { name: "Crear categoría", exact: true })
      .click();
    await expect(
      settings
        .getByRole("region", { name: "Categorías de ingresos", exact: true })
        .getByText("Trabajo independiente", { exact: true }),
    ).toBeVisible();
    await settings
      .getByRole("button", { name: "Agregar categoría de egreso", exact: true })
      .click();
    form = settings.getByRole("form", { name: "Crear categoría", exact: true });
    await expect(
      form.getByLabel("Tipo de categoría", { exact: true }),
    ).toHaveValue("expense");
    await form
      .getByLabel("Nombre de categoría", { exact: true })
      .fill("Mascotas");
    await form
      .getByRole("button", { name: "Crear categoría", exact: true })
      .click();
    await settings
      .getByRole("button", { name: "Editar categoría Mascotas", exact: true })
      .click();
    const edit = settings.getByRole("form", {
      name: "Editar categoría",
      exact: true,
    });
    await expect(
      edit.getByLabel("Tipo de categoría", { exact: true }),
    ).toBeDisabled();
    await edit
      .getByLabel("Nombre de categoría", { exact: true })
      .fill("Cuidado de mascotas");
    await edit
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await expect(
      settings
        .getByRole("region", { name: "Categorías de egresos", exact: true })
        .getByText("Cuidado de mascotas", { exact: true }),
    ).toBeVisible();
    expect(writes).toBe(3);
    await settings
      .getByRole("button", { name: "Agregar categoría de egreso", exact: true })
      .click();
    form = settings.getByRole("form", { name: "Crear categoría", exact: true });
    await form
      .getByLabel("Nombre de categoría", { exact: true })
      .fill("cuidado DE mascotas");
    await form
      .getByRole("button", { name: "Crear categoría", exact: true })
      .click();
    await expect(form.getByRole("alert")).toHaveText(
      "Ya tienes una categoría con ese nombre para este tipo.",
    );
    expect(writes).toBe(3);
    await form.getByRole("button", { name: "Cancelar", exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/categorias-${width}.png`,
      fullPage: true,
    });
    await navigate("Asistente AFI");
    await page
      .getByRole("button", { name: "Registrar gasto", exact: true })
      .click();
    const send = async (value: string) => {
      await page.getByLabel("Mensaje para AFI", { exact: true }).fill(value);
      await page
        .getByRole("button", { name: "Enviar mensaje", exact: true })
        .click();
    };
    await send("20");
    await send("Comida para mi mascota");
    await page.getByRole("button", { name: "Efectivo", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Cuidado de mascotas", exact: true }),
    ).toBeVisible();
  });

test("Pregunta de seguridad recupera la clave sin correo ni código", async ({
  page,
}) => {
  let sent: any;
  await page.route(
    "http://localhost:4000/api/v1/auth/security-question/lookup",
    (r) => r.fulfill({ json: { question: "¿Cuál es mi frase privada?" } }),
  );
  await page.route(
    "http://localhost:4000/api/v1/auth/security-question/reset",
    async (r) => {
      sent = r.request().postDataJSON();
      await r.fulfill({ json: { ok: true } });
    },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Olvidé mi contraseña" }).click();
  await page.getByLabel("Usuario", { exact: true }).fill("ealva");
  await page
    .getByRole("button", { name: "Ver mi pregunta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "¿Cuál es mi frase privada?",
      exact: true,
    }),
  ).toBeVisible();
  const form = page.getByRole("form", {
    name: "Recuperar con pregunta de seguridad",
    exact: true,
  });
  await form
    .getByLabel("Tu respuesta", { exact: true })
    .fill("Un recuerdo del verano");
  await form
    .getByLabel("Nueva contraseña", { exact: true })
    .fill("Recovered.WithQuestion-2026!");
  await form
    .getByLabel("Confirmar nueva contraseña", { exact: true })
    .fill("Recovered.WithQuestion-2026!");
  await form
    .getByRole("button", { name: "Guardar nueva contraseña", exact: true })
    .click();
  await expect(
    page.getByText(
      "Contraseña actualizada. Inicia sesión con tu nueva clave.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(sent.username).toBe("ealva");
  expect(sent.answer).toBe("Un recuerdo del verano");
  expect(sent.code).toBeUndefined();
});

test("Primera configuración exige código y luego permite responder la pregunta", async ({
  page,
}) => {
  let proof: any;
  await page.route(
    "http://localhost:4000/api/v1/auth/security-question/lookup",
    (r) => r.fulfill({ json: { question: null } }),
  );
  await page.route(
    "http://localhost:4000/api/v1/auth/security-question/setup",
    async (r) => {
      proof = r.request().postDataJSON();
      await r.fulfill({ json: { ok: true } });
    },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Olvidé mi contraseña" }).click();
  await page.getByLabel("Usuario", { exact: true }).fill("ealva");
  await page
    .getByRole("button", { name: "Ver mi pregunta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Configurar por primera vez", exact: true })
    .click();
  const form = page.getByRole("form", {
    name: "Configurar pregunta de seguridad",
    exact: true,
  });
  await form
    .getByLabel("Pregunta de seguridad", { exact: true })
    .fill("¿Cuál es mi frase privada?");
  await form
    .getByLabel("Respuesta privada", { exact: true })
    .fill("Un recuerdo del verano");
  await form
    .getByLabel("Confirmar respuesta", { exact: true })
    .fill("Un recuerdo del verano");
  await form
    .getByLabel("Código de recuperación inicial", { exact: true })
    .fill("a".repeat(43));
  await form
    .getByRole("button", { name: "Guardar pregunta de seguridad", exact: true })
    .click();
  await expect(
    page.getByRole("form", {
      name: "Recuperar con pregunta de seguridad",
      exact: true,
    }),
  ).toBeVisible();
  expect(proof.code).toBe("a".repeat(43));
  expect(proof.username).toBe("ealva");
});

test("Configuración guarda pregunta privada solo enviando clave actual y JWT", async ({
  page,
}) => {
  await mock(page);
  let captured: any;
  let authorization: string | undefined;
  await page.route(
    "http://localhost:4000/api/v1/auth/security-question/setup",
    async (r) => {
      captured = r.request().postDataJSON();
      authorization = r.request().headers().authorization;
      await r.fulfill({ json: { ok: true } });
    },
  );
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  const form = page.getByRole("form", {
    name: "Configurar pregunta de seguridad",
    exact: true,
  });
  await form
    .getByLabel("Respuesta privada", { exact: true })
    .fill("Un recuerdo del verano");
  await form
    .getByLabel("Confirmar respuesta", { exact: true })
    .fill("Un recuerdo del verano");
  await form
    .getByLabel("Contraseña actual", { exact: true })
    .fill("CurrentPassword.2026!");
  await form
    .getByRole("button", { name: "Guardar pregunta de seguridad", exact: true })
    .click();
  await expect(
    form.getByText("Pregunta de seguridad guardada correctamente.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(authorization).toBe("Bearer test-jwt");
  expect(captured.currentPassword).toBe("CurrentPassword.2026!");
  expect(captured.code).toBeUndefined();
  await expect(
    form.getByLabel("Respuesta privada", { exact: true }),
  ).toHaveValue("");
});

for (const username of ["mramirez", "ealva"]) {
  test(`El formulario envía ${username}@afi.com al escribir solo el usuario`, async ({
    page,
  }) => {
    await page.route(
      "http://localhost:4000/api/v1/auth/login",
      async (route) => {
        await route.fulfill({
          status: 400,
          json: {
            error: {
              code: "invalid_credentials",
              message:
                "Respuesta de Auth simulada para comprobar el correo enviado",
            },
          },
        });
      },
    );
    await page.goto("/");
    await page
      .getByLabel("Usuario o correo electrónico", { exact: true })
      .fill(username);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill("OnlyTest.Login-2026!");
    const request = page.waitForRequest(
      (r) => r.url().includes("/auth/login") && r.method() === "POST",
    );
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    expect((await request).postDataJSON().email).toBe(`${username}@afi.com`);
    await expect(
      page.getByText(
        "Respuesta de Auth simulada para comprobar el correo enviado",
      ),
    ).toBeVisible();
  });
}
const uid = "11111111-1111-4111-8111-111111111111";
const aid = "22222222-2222-4222-8222-222222222222";
const gid = "33333333-3333-4333-8333-333333333333";
const now = new Date().toISOString();
const records: Record<string, any[]> = {
  profile: [
    {
      id: uid,
      display_name: "Eloy",
      currency: "PEN",
      timezone: "America/Lima",
    },
  ],
  preferences: [{ ant_expense_threshold: 20 }],
  accounts: [
    {
      id: aid,
      name: "Efectivo",
      type: "cash",
      currency: "PEN",
      opening_balance: 500,
      active: true,
    },
  ],
  categories: [
    { id: gid, name: "Alimentación", type: "expense" },
    {
      id: "55555555-5555-4555-8555-555555555555",
      name: "Sueldo",
      type: "income",
    },
  ],
  transactions: [],
  cards: [],
  debts: [],
  goals: [],
  spaces: [],
  occurrences: [],
  budgets: [],
};
const summary = {
  currency: "PEN",
  month: now.slice(0, 7),
  today: now.slice(0, 10),
  income: 0,
  expense: 0,
  liquidity: 500,
  reserved: 0,
  unallocated: 0,
  allocated: 0,
  estimatedSavingCapacity: 0,
  dayIncome: 0,
  dayExpense: 0,
  antExpenses: 0,
  creditLimit: 0,
  creditUsed: 0,
  creditAvailable: 0,
  debtTotal: 0,
  accounts: [{ ...records.accounts[0], balance: 500 }],
  cards: [],
  debts: [],
  goals: [],
  occurrences: [],
  budgets: [],
  payments: { due: 0, paid: 0, pending: 0, overdue: 0, covered: 100 },
  categoryTotals: [],
  evolution: [{ month: now.slice(0, 7), income: 0, expense: 0 }],
};
async function mock(page: Page) {
  await page.addInitScript(
    ({ uid }) => {
      if (sessionStorage.getItem("afi-test-seeded")) return;
      sessionStorage.setItem("afi-test-seeded", "true");
      const expires = Math.floor(Date.now() / 1000) + 3600;
      localStorage.setItem(
        "afi-auth-session-v1",
        JSON.stringify({
          access_token: "test-jwt",
          refresh_token: "test-refresh",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: expires,
          user: {
            id: uid,
            aud: "authenticated",
            role: "authenticated",
            email: "one@example.com",
            app_metadata: {},
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        }),
      );
    },
    { uid },
  );
  await page.route("http://localhost:4000/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const resource = url.pathname.split("/api/v1/")[1];
    if (route.request().method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "GET,POST,PUT,PATCH,OPTIONS",
        },
      });
    if (resource === "auth/session")
      return route.fulfill({
        json: {
          session: {
            ...route.request().postDataJSON(),
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: uid, email: "one@example.com" },
          },
        },
      });
    if (resource === "auth/reauthenticate")
      return route.fulfill({ json: { ok: true } });
    if (resource === "dashboard") return route.fulfill({ json: summary });
    if (route.request().method() !== "GET")
      return route.fulfill({ json: { id: gid, ok: true } });
    return route.fulfill({
      json: {
        data: records[resource] ?? [],
        total: (records[resource] ?? []).length,
        page: 1,
        limit: 100,
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hablemos de tus finanzas" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Registrar gasto", exact: true }),
  ).toBeEnabled();
}

test("Cambiar contraseña valida confirmación y actualiza con la clave actual", async ({
  page,
}) => {
  await mock(page);
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  const form = page.getByRole("form", {
    name: "Cambiar contraseña",
    exact: true,
  });
  let updates = 0;
  await page.route(
    "http://localhost:4000/api/v1/auth/password",
    async (route) => {
      if (route.request().method() === "PUT") updates++;
      await route.fulfill({
        json: {
          id: uid,
          aud: "authenticated",
          email: "one@example.com",
          app_metadata: {},
          user_metadata: {},
        },
      });
    },
  );
  await form
    .getByLabel("Contraseña actual", { exact: true })
    .fill("CurrentPassword.2026!");
  await form
    .getByLabel("Nueva contraseña", { exact: true })
    .fill("NewPassword.2026!");
  await form
    .getByLabel("Confirmar nueva contraseña", { exact: true })
    .fill("DifferentPassword.2026!");
  await form
    .getByRole("button", { name: "Cambiar contraseña", exact: true })
    .click();
  await expect(
    form.getByText("Las contraseñas no coinciden.", { exact: true }),
  ).toBeVisible();
  expect(updates).toBe(0);
  await form
    .getByLabel("Confirmar nueva contraseña", { exact: true })
    .fill("NewPassword.2026!");
  await form.getByRole("button", { name: "Mostrar contraseñas" }).click();
  await expect(
    form.getByLabel("Nueva contraseña", { exact: true }),
  ).toHaveAttribute("type", "text");
  const request = page.waitForRequest(
    (r) => r.url().endsWith("/auth/password") && r.method() === "PUT",
  );
  await form
    .getByRole("button", { name: "Cambiar contraseña", exact: true })
    .click();
  const body = (await request).postDataJSON();
  expect(body.password).toBe("NewPassword.2026!");
  expect(body.current_password).toBe("CurrentPassword.2026!");
  await expect(
    form.getByText(/Contraseña actualizada correctamente/),
  ).toBeVisible();
  await expect(
    form.getByLabel("Contraseña actual", { exact: true }),
  ).toHaveValue("");
  await expect(
    form.getByLabel("Nueva contraseña", { exact: true }),
  ).toHaveValue("");
  await expect(
    form.getByLabel("Nueva contraseña", { exact: true }),
  ).toHaveAttribute("type", "password");
});

test("Una clave actual incorrecta no muestra éxito y permite corregirla", async ({
  page,
}) => {
  await mock(page);
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  await page.route("http://localhost:4000/api/v1/auth/password", (r) =>
    r.fulfill({
      status: 400,
      json: {
        error: {
          code: "invalid_password",
          message: "Current password is incorrect",
        },
      },
    }),
  );
  const form = page.getByRole("form", {
    name: "Cambiar contraseña",
    exact: true,
  });
  await form
    .getByLabel("Contraseña actual", { exact: true })
    .fill("WrongPassword.2026!");
  await form
    .getByLabel("Nueva contraseña", { exact: true })
    .fill("NewPassword.2026!");
  await form
    .getByLabel("Confirmar nueva contraseña", { exact: true })
    .fill("NewPassword.2026!");
  await form
    .getByRole("button", { name: "Cambiar contraseña", exact: true })
    .click();
  await expect(form.getByRole("alert")).toHaveText(
    "La contraseña actual no es correcta.",
  );
  await expect(
    form.getByText(/Contraseña actualizada correctamente/),
  ).not.toBeVisible();
  await expect(
    form.getByRole("button", { name: "Cambiar contraseña", exact: true }),
  ).toBeEnabled();
});

test("Recuperación admite usuario corto y no cambia contraseñas al enviar el enlace", async ({
  page,
}) => {
  let updates = 0;
  await page.route("http://localhost:4000/api/v1/auth/**", async (route) => {
    if (route.request().method() === "PUT") updates++;
    await route.fulfill({ json: {} });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Olvidé mi contraseña" }).click();
  await page
    .getByRole("button", { name: "Usar código de recuperación", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Recuperar por correo", exact: true })
    .click();
  await page
    .getByLabel("Usuario o correo electrónico", { exact: true })
    .fill("ealva");
  const request = page.waitForRequest((r) => r.url().includes("/auth/recover"));
  await page
    .getByRole("button", { name: "Enviar enlace", exact: true })
    .click();
  expect((await request).postDataJSON().email).toBe("ealva@afi.com");
  await expect(
    page.getByText(/Si la cuenta existe, recibirás un enlace/),
  ).toBeVisible();
  expect(updates).toBe(0);
});

test("Un enlace de recuperación permite confirmar una nueva clave sin la anterior", async ({
  page,
}) => {
  await mock(page);
  const jwt = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: uid,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: "https://afi-test.supabase.co/auth/v1",
      }),
    ).toString("base64url"),
    "test-signature",
  ].join(".");
  await page.goto("about:blank");
  await page.goto(
    "/#access_token=" +
      jwt +
      "&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=recovery",
  );
  const form = page.getByRole("form", {
    name: "Restablecer contraseña",
    exact: true,
  });
  await expect(form).toBeVisible();
  await expect(
    form.getByLabel("Contraseña actual", { exact: true }),
  ).not.toBeVisible();
  await form
    .getByLabel("Nueva contraseña", { exact: true })
    .fill("RecoveryPassword.2026!");
  await form
    .getByLabel("Confirmar nueva contraseña", { exact: true })
    .fill("RecoveryPassword.2026!");
  const request = page.waitForRequest(
    (r) => r.url().endsWith("/auth/password") && r.method() === "PUT",
  );
  await form
    .getByRole("button", { name: "Guardar nueva contraseña", exact: true })
    .click();
  const body = (await request).postDataJSON();
  expect(body.password).toBe("RecoveryPassword.2026!");
  expect(body.current_password).toBeUndefined();
  await expect(
    page.getByRole("heading", { name: "Hablemos de tus finanzas" }),
  ).toBeVisible();
  expect(page.url()).not.toContain("access_token");
});

test("Un enlace vencido explica cómo solicitar uno nuevo", async ({ page }) => {
  await page.goto(
    "/#error=access_denied&error_code=otp_expired&error_description=Expired",
  );
  await expect(
    page.getByRole("alert").filter({ hasText: "El enlace de recuperación" }),
  ).toContainText("El enlace de recuperación no es válido o venció");
  await expect(
    page.getByRole("form", { name: "Restablecer contraseña" }),
  ).not.toBeVisible();
});

test("Recuperación sin correo pide código, confirma la nueva clave y vuelve al login", async ({
  page,
}) => {
  let requests = 0;
  await page.route(
    "http://localhost:4000/api/v1/auth/password-recovery",
    async (r) => {
      requests++;
      await r.fulfill({ json: { ok: true } });
    },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Olvidé mi contraseña" }).click();
  await page
    .getByRole("button", { name: "Usar código de recuperación", exact: true })
    .click();
  const form = page.getByRole("form", {
    name: "Recuperar con código",
    exact: true,
  });
  await form.getByLabel("Usuario", { exact: true }).fill("ealva");
  await form
    .getByLabel("Nueva contraseña", { exact: true })
    .fill("Recovered.WithCode-2026!");
  await form
    .getByLabel("Confirmar nueva contraseña", { exact: true })
    .fill("Recovered.WithCode-2026!");
  await form
    .getByRole("button", { name: "Guardar nueva contraseña", exact: true })
    .click();
  await expect(
    form.getByText("Pega el código completo entregado por el administrador.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(requests).toBe(0);
  await form
    .getByLabel("Código de recuperación", { exact: true })
    .fill("a".repeat(43));
  const request = page.waitForRequest((r) =>
    r.url().endsWith("/auth/password-recovery"),
  );
  await form
    .getByRole("button", { name: "Guardar nueva contraseña", exact: true })
    .click();
  const payload = (await request).postDataJSON();
  expect(payload.username).toBe("ealva");
  expect(payload.code).toBe("a".repeat(43));
  expect(payload.password).toBe("Recovered.WithCode-2026!");
  expect(requests).toBe(1);
  await expect(
    page.getByText(
      "Contraseña actualizada. Inicia sesión con tu nueva clave.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
});

test("Un código rechazado mantiene al usuario fuera de la sesión", async ({
  page,
}) => {
  await page.route("http://localhost:4000/api/v1/auth/password-recovery", (r) =>
    r.fulfill({
      status: 400,
      json: {
        error: {
          message:
            "Usuario o código de recuperación inválido, vencido o ya utilizado.",
        },
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Olvidé mi contraseña" }).click();
  await page
    .getByRole("button", { name: "Usar código de recuperación", exact: true })
    .click();
  const form = page.getByRole("form", {
    name: "Recuperar con código",
    exact: true,
  });
  await form.getByLabel("Usuario", { exact: true }).fill("ealva");
  await form
    .getByLabel("Código de recuperación", { exact: true })
    .fill("a".repeat(43));
  await form
    .getByLabel("Nueva contraseña", { exact: true })
    .fill("Recovered.WithCode-2026!");
  await form
    .getByLabel("Confirmar nueva contraseña", { exact: true })
    .fill("Recovered.WithCode-2026!");
  await form
    .getByRole("button", { name: "Guardar nueva contraseña", exact: true })
    .click();
  await expect(form.getByRole("alert")).toHaveText(
    "Usuario o código de recuperación inválido, vencido o ya utilizado.",
  );
  await expect(
    page.getByRole("heading", { name: "Hablemos de tus finanzas" }),
  ).not.toBeVisible();
});

test("La reautenticación permite enviar y confirmar el código de seguridad", async ({
  page,
}) => {
  await mock(page);
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  let attempts = 0;
  await page.route("http://localhost:4000/api/v1/auth/password", async (r) => {
    if (r.request().method() === "PUT" && ++attempts === 1)
      return r.fulfill({
        status: 400,
        json: {
          error: {
            code: "reauthentication_needed",
            message: "Reauthentication needed",
          },
        },
      });
    await r.fulfill({
      json: {
        id: uid,
        email: "one@example.com",
        aud: "authenticated",
        app_metadata: {},
        user_metadata: {},
      },
    });
  });
  const form = page.getByRole("form", {
    name: "Cambiar contraseña",
    exact: true,
  });
  await form
    .getByLabel("Contraseña actual", { exact: true })
    .fill("CurrentPassword.2026!");
  await form
    .getByLabel("Nueva contraseña", { exact: true })
    .fill("NewPassword.2026!");
  await form
    .getByLabel("Confirmar nueva contraseña", { exact: true })
    .fill("NewPassword.2026!");
  await form
    .getByRole("button", { name: "Cambiar contraseña", exact: true })
    .click();
  await expect(
    form.getByLabel("Código de verificación", { exact: true }),
  ).toBeVisible();
  const codeRequest = page.waitForRequest((r) =>
    r.url().includes("/auth/reauthenticate"),
  );
  await form
    .getByRole("button", { name: "Enviar código de verificación", exact: true })
    .click();
  await codeRequest;
  await form
    .getByLabel("Código de verificación", { exact: true })
    .fill("123456");
  const update = page.waitForRequest(
    (r) => r.url().endsWith("/auth/password") && r.method() === "PUT",
  );
  await form
    .getByRole("button", { name: "Cambiar contraseña", exact: true })
    .click();
  expect((await update).postDataJSON().nonce).toBe("123456");
  await expect(
    form.getByText(/Contraseña actualizada correctamente/),
  ).toBeVisible();
});
for (const width of [390, 768, 1440])
  test(`Navegación y formularios sin desbordamiento a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await mock(page);
    for (const name of [
      "Movimientos",
      "Mis cuentas",
      "Tarjetas de crédito",
      "Préstamos",
      "Pagos y calendario",
      "Presupuestos",
      "Objetivos de ahorro",
      "Espacios compartidos",
      "Asistente AFI",
    ]) {
      if (width <= 800)
        await page.getByRole("button", { name: "Abrir menú" }).click();
      await page
        .locator("nav")
        .getByRole("button", { name, exact: true })
        .click();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
    }
    if (width <= 800)
      await page.getByRole("button", { name: "Abrir menú" }).click();
    await page
      .locator("nav")
      .getByRole("button", { name: "Movimientos", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Registrar movimiento", exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Monto").fill("25");
    await dialog.getByLabel("Cuenta de origen").selectOption(aid);
    await dialog.getByLabel("Descripción").fill("Almuerzo");
    const request = page.waitForRequest(
      (r) => r.url().endsWith("/transactions") && r.method() === "POST",
    );
    await dialog.getByRole("button", { name: "Guardar movimiento" }).click();
    const req = await request;
    expect(req.postDataJSON().amount).toBe(25);
    expect(req.postDataJSON().type).toBe("expense");
    expect(req.headers()["idempotency-key"]).toBeTruthy();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.screenshot({
      path: `test-results/movimientos-${width}.png`,
      fullPage: true,
    });
  });
test("La IA pide revisión y confirmación antes de escribir", async ({
  page,
}) => {
  await mock(page);
  await page
    .locator("nav")
    .getByRole("button", { name: "Asistente AFI", exact: true })
    .click();
  let writes = 0;
  await page.route("**/ai/interpret", (r) =>
    r.fulfill({
      json: {
        extracted: {
          type: "expense",
          amount: 25,
          currency: "PEN",
          description: "Almuerzo",
          date: now.slice(0, 10),
          account_id: null,
          category_id: gid,
        },
        missing: [],
        requiresConfirmation: true,
      },
    }),
  );
  page.on("request", (r) => {
    if (
      r.method() === "POST" &&
      (r.url().endsWith("/transactions") || r.url().includes("/confirm"))
    )
      writes++;
  });
  await page.getByLabel("Mensaje para AFI").fill("Gasté 25 soles en almuerzo");
  await page
    .getByRole("button", { name: "Enviar mensaje", exact: true })
    .click();
  await expect(
    page.getByText("¿Desde qué cuenta pagaste?", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Efectivo", exact: true }).click();
  await page.getByRole("button", { name: "Hoy", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Resumen para confirmar", exact: true }),
  ).toBeVisible();
  expect(writes).toBe(0);
  await page
    .getByRole("button", { name: "Confirmar y registrar", exact: true })
    .click();
  await expect(
    page.getByText(/Movimiento registrado correctamente: gasto/),
  ).toBeVisible();
  expect(writes).toBe(1);
});

test("El asistente aparece primero y guía un ingreso sin crear cuentas ni gastos", async ({
  page,
}) => {
  await mock(page);
  await expect(page.locator("nav button").first()).toHaveAccessibleName(
    "Asistente AFI",
  );
  let aiCalls = 0;
  const financialRequests: { url: string; body: any }[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/ai/interpret")) aiCalls++;
    if (
      r.method() === "POST" &&
      (r.url().endsWith("/ai/drafts") ||
        r.url().endsWith("/transactions") ||
        r.url().endsWith("/accounts"))
    )
      financialRequests.push({ url: r.url(), body: r.postDataJSON() });
  });
  await page
    .getByRole("button", { name: "Registrar ingreso", exact: true })
    .click();
  const send = async (text: string) => {
    await page.getByLabel("Mensaje para AFI").fill(text);
    await page
      .getByRole("button", { name: "Enviar mensaje", exact: true })
      .click();
  };
  await expect(page.getByText(/¿Cuál fue el monto en PEN/)).toBeVisible();
  await send("500");
  await expect(
    page.getByText(
      "¿De dónde vino ese ingreso? Cuéntame una breve descripción.",
      { exact: true },
    ),
  ).toBeVisible();
  await send("Sueldo de octubre");
  await expect(
    page.getByText("¿En qué cuenta recibiste el dinero?", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Efectivo", exact: true }).click();
  await page.getByRole("button", { name: "Sueldo", exact: true }).click();
  await page.getByRole("button", { name: "Hoy", exact: true }).click();
  expect(financialRequests).toHaveLength(0);
  await send("sí");
  await expect(
    page.getByText(/Movimiento registrado correctamente: ingreso/),
  ).toBeVisible();
  expect(aiCalls).toBe(0);
  expect(financialRequests).toHaveLength(1);
  expect(financialRequests[0].url).toContain("/ai/drafts");
  expect(financialRequests[0].body.type).toBe("income");
  expect(financialRequests[0].body.destination_account_id).toBe(aid);
  expect(financialRequests[0].body.source_account_id).toBeUndefined();
});

test("Editar el resumen y reintentar conservan una sola confirmación idempotente", async ({
  page,
}) => {
  await mock(page);
  await page.route("**/ai/interpret", (r) =>
    r.fulfill({
      json: {
        extracted: {
          type: "expense",
          amount: 25,
          currency: "PEN",
          description: "Almuerzo",
          date: now.slice(0, 10),
          account_id: aid,
          category_id: gid,
        },
      },
    }),
  );
  let attempts = 0;
  const keys: string[] = [];
  let draftAmount: number | undefined;
  await page.route("**/ai/drafts", async (r) => {
    draftAmount = r.request().postDataJSON().amount;
    await r.fulfill({ json: { id: gid } });
  });
  await page.route("**/ai/drafts/*/confirm", async (r) => {
    attempts++;
    keys.push(r.request().headers()["idempotency-key"]);
    await r.fulfill(
      attempts === 1
        ? {
            status: 503,
            json: {
              error: { message: "No se recibió la respuesta del servidor" },
            },
          }
        : { json: { id: gid } },
    );
  });
  await page.getByLabel("Mensaje para AFI").fill("Gasté 25 en almuerzo");
  await page
    .getByRole("button", { name: "Enviar mensaje", exact: true })
    .click();
  await page.getByRole("button", { name: "Hoy", exact: true }).click();
  await page.getByRole("button", { name: "Editar datos", exact: true }).click();
  await page.getByLabel("Editar monto", { exact: true }).fill("30");
  await page
    .getByRole("button", { name: "Aplicar cambios", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar y registrar", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Reintenta para verificar" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Editar datos", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Reintentar registro", exact: true })
    .click();
  await expect(
    page.getByText(/Movimiento registrado correctamente: gasto/),
  ).toBeVisible();
  expect(draftAmount).toBe(30);
  expect(attempts).toBe(2);
  expect(keys[0]).toBe(keys[1]);
});

test("Objetivos compartidos muestran cuotas y sugieren reparto por vencimiento", async ({
  page,
}) => {
  await mock(page);
  const space = "66666666-6666-4666-8666-666666666666";
  const other = "77777777-7777-4777-8777-777777777777";
  const goals = [
    {
      id: gid,
      name: "Viaje compartido",
      currency: "PEN",
      space_id: space,
      ideal_amount: 1000,
      target_date: "2026-12-01",
      confirmed: 100,
      planned: 0,
      remaining: 900,
      progress: 10,
      priority: 2,
    },
    {
      id: "later",
      name: "Estudios",
      currency: "PEN",
      ideal_amount: 2000,
      target_date: "2027-03-01",
      confirmed: 0,
      planned: 0,
      remaining: 2000,
      progress: 0,
      priority: 2,
    },
    {
      id: "middle",
      name: "Equipo",
      currency: "PEN",
      ideal_amount: 1500,
      target_date: "2027-01-01",
      confirmed: 0,
      planned: 0,
      remaining: 1500,
      progress: 0,
      priority: 2,
    },
  ];
  const fixtures: Record<string, any[]> = {
    goals,
    spaces: [{ id: space, name: "Familia", owner_id: uid }],
    members: [
      { space_id: space, user_id: uid, role: "admin", display_name: "Eloy" },
      {
        space_id: space,
        user_id: other,
        role: "member",
        display_name: "Marines",
      },
    ],
    "goal-members": [
      { goal_id: gid, user_id: uid, percentage: 60 },
      { goal_id: gid, user_id: other, percentage: 40 },
    ],
  };
  for (const [resource, data] of Object.entries(fixtures)) {
    await page.route(`**/api/v1/${resource}?*`, (r) =>
      r.fulfill({ json: { data, total: data.length } }),
    );
  }
  await page.route("**/api/v1/dashboard?*", (r) =>
    r.fulfill({ json: { ...summary, goals } }),
  );
  await page.reload();
  await page
    .locator("nav")
    .getByRole("button", { name: "Objetivos de ahorro", exact: true })
    .click();
  await expect(page.getByText(/Tú: 60% · Meta/)).toBeVisible();
  await page
    .getByRole("button", { name: "Definir aportes por persona" })
    .click();
  await expect(page.getByLabel("Porcentaje Eloy", { exact: true })).toHaveValue(
    "60",
  );
  await expect(
    page.getByLabel("Porcentaje Marines", { exact: true }),
  ).toHaveValue("40");
  await page.getByLabel("Porcentaje Eloy", { exact: true }).fill("70");
  await page.getByLabel("Porcentaje Marines", { exact: true }).fill("30");
  const participation = page.waitForRequest((r) =>
    r.url().endsWith(`/goals/${gid}/members`),
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Guardar participación/ })
    .click();
  expect((await participation).postDataJSON().members).toEqual([
    { user_id: uid, percentage: 70 },
    { user_id: other, percentage: 30 },
  ]);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Distribuir por porcentaje", exact: true })
    .click();
  await page.getByRole("button", { name: "Sugerir por fecha de fin" }).click();
  await expect(
    page.getByLabel("Porcentaje Viaje compartido", { exact: true }),
  ).toHaveValue("50");
  await expect(
    page.getByLabel("Porcentaje Equipo", { exact: true }),
  ).toHaveValue("30");
  await expect(
    page.getByLabel("Porcentaje Estudios", { exact: true }),
  ).toHaveValue("20");
});

test("El reparto porcentual utiliza nombres y confirma un único lote", async ({
  page,
}) => {
  await mock(page);
  const second = "44444444-4444-4444-8444-444444444444";
  await page.route("**/api/v1/goals?*", (r) =>
    r.fulfill({
      json: {
        data: [
          { id: gid, name: "Viaje", currency: "PEN" },
          { id: second, name: "Fondo de emergencia", currency: "PEN" },
        ],
        total: 2,
      },
    }),
  );
  await page
    .locator("nav")
    .getByRole("button", { name: "Resumen general", exact: true })
    .click();
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Objetivos de ahorro", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Distribuir por porcentaje", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Monto del fondo a distribuir")
    .fill("100");
  await page.getByLabel("Porcentaje Viaje", { exact: true }).fill("60");
  await page
    .getByLabel("Porcentaje Fondo de emergencia", { exact: true })
    .fill("30");
  await page.getByLabel("Porcentaje Sin asignar", { exact: true }).fill("10");
  await expect(page.getByText("Total: 100.00%", { exact: true })).toBeVisible();
  const request = page.waitForRequest((r) =>
    r.url().endsWith("/savings/distribute"),
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Guardar distribución/ })
    .click();
  const body = (await request).postDataJSON();
  expect(body.amount).toBe(100);
  expect(body.distribution).toEqual([
    { goal_id: gid, percentage: 60 },
    { goal_id: second, percentage: 30 },
    { goal_id: null, percentage: 10 },
  ]);
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("Recargar tras una respuesta perdida recupera el registro sin volver a confirmarlo", async ({
  page,
}) => {
  await mock(page);
  let confirmations = 0;
  const payload = {
    type: "expense",
    amount: 25,
    currency: "PEN",
    occurred_at: now,
    category_id: gid,
    source_account_id: aid,
    description: "Almuerzo",
  };
  await page.route("**/ai/interpret", (r) =>
    r.fulfill({
      json: {
        extracted: {
          type: "expense",
          amount: 25,
          currency: "PEN",
          description: "Almuerzo",
          date: now.slice(0, 10),
          account_id: aid,
          category_id: gid,
        },
      },
    }),
  );
  await page.route("**/ai/drafts/*/confirm", async (r) => {
    confirmations++;
    await r.fulfill({
      status: 503,
      json: { error: { message: "Respuesta perdida" } },
    });
  });
  await page.route("**/ai/drafts/" + gid, (r) =>
    r.fulfill({
      json: {
        id: gid,
        payload,
        transaction_id: "already-saved",
        expires_at: new Date(Date.now() + 1800000).toISOString(),
      },
    }),
  );
  await page.getByLabel("Mensaje para AFI").fill("Gasté 25 soles en almuerzo");
  await page
    .getByRole("button", { name: "Enviar mensaje", exact: true })
    .click();
  await page.getByRole("button", { name: "Hoy", exact: true }).click();
  await page.screenshot({
    path: "test-results/asistente-resumen.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Confirmar y registrar", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reintentar registro", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText(/Movimiento registrado correctamente: gasto/),
  ).toBeVisible();
  expect(confirmations).toBe(1);
  expect(
    await page.evaluate(
      (id) => sessionStorage.getItem("afi.pending-ai." + id),
      uid,
    ),
  ).toBeNull();
});
