import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSeedUsers } from "../scripts/seed-users-model";

const person = { name: "Compte de recette", email: "admin@recette.kipcity.test", role: "ADMIN" };
const defaultPassword = "test-password-1234";
test("Seed utilisateurs : mot de passe commun et surcharge individuelle", () => {
  const users = parseSeedUsers({ defaultPassword, users: [person, { ...person, email: "agent@recette.kipcity.test", password: "other-password-1234" }] }, true);
  assert.equal(users[0].password, defaultPassword);
  assert.equal(users[1].password, "other-password-1234");
});
test("Seed utilisateurs : format historique et contrôles des accès", () => {
  assert.equal(parseSeedUsers([{ ...person, password: defaultPassword }], true)[0].role, "ADMIN");
  assert.throws(() => parseSeedUsers({ defaultPassword, users: [person, { ...person, email: person.email.toUpperCase() }] }, true));
  assert.throws(() => parseSeedUsers({ defaultPassword: "short", users: [person] }, true));
  assert.throws(() => parseSeedUsers([person], true));
  assert.throws(() => parseSeedUsers({ defaultPassword, users: [person] }, false));
  assert.throws(() => parseSeedUsers({ defaultPassword, users: [{ ...person, role: "UNKNOWN" }] }, true));
});
