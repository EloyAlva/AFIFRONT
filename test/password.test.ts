import test from "node:test";
import assert from "node:assert/strict";
import {
  passwordFormSchema,
  newPassword,
  passwordError,
} from "../src/lib/password";

const valid = {
  currentPassword: "CurrentPassword.2026!",
  password: "NewPassword.2026!",
  confirmation: "NewPassword.2026!",
  nonce: "",
};
test("Cambiar clave exige clave actual, longitud y confirmación coincidente", () => {
  assert.equal(passwordFormSchema(false).safeParse(valid).success, true);
  assert.equal(
    passwordFormSchema(false).safeParse({ ...valid, currentPassword: "" })
      .success,
    false,
  );
  assert.equal(
    passwordFormSchema(false).safeParse({
      ...valid,
      confirmation: "OtraPassword.2026!",
    }).success,
    false,
  );
  assert.equal(
    passwordFormSchema(false).safeParse({
      ...valid,
      password: valid.currentPassword,
      confirmation: valid.currentPassword,
    }).success,
    false,
  );
  assert.equal(newPassword.safeParse("12345678").success, false);
  assert.equal(newPassword.safeParse("ñ".repeat(37)).success, false);
});
test("Una sesión de recuperación permite crear clave sin la anterior", () => {
  assert.equal(
    passwordFormSchema(true).safeParse({ ...valid, currentPassword: "" })
      .success,
    true,
  );
});
test("Los errores de Auth ofrecen instrucciones de recuperación", () => {
  assert.match(
    passwordError({ code: "invalid_password", message: "Provider error" }),
    /actual no es correcta/,
  );
  assert.match(
    passwordError({
      code: "reauthentication_needed",
      message: "Provider error",
    }),
    /código/,
  );
  assert.match(
    passwordError({ code: "session_not_found", message: "Provider error" }),
    /sesión venció/,
  );
});
