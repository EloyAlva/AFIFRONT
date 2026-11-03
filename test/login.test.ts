import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLoginEmail } from "../src/lib/login";

test("El login completa @afi.com y normaliza espacios y mayúsculas", () => {
  assert.equal(normalizeLoginEmail("mramirez"), "mramirez@afi.com");
  assert.equal(normalizeLoginEmail(" EALVA "), "ealva@afi.com");
});

test("Un correo completo conserva su dominio", () => {
  assert.equal(normalizeLoginEmail("EALVA@AFI.COM"), "ealva@afi.com");
  assert.equal(
    normalizeLoginEmail("persona@example.com"),
    "persona@example.com",
  );
});

test("Un usuario inválido no se envía a Supabase", () => {
  for (const value of ["", "   ", "el oy", "@afi.com", "ealva@@afi.com"]) {
    assert.throws(() => normalizeLoginEmail(value));
  }
});
