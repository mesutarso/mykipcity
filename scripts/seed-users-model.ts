import { z } from "zod";
import { staffRoles } from "../src/lib/roles";

const password = z.string().min(12).max(128);
const user = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.email().trim().toLowerCase(),
  role: z.enum(Object.keys(staffRoles) as [keyof typeof staffRoles, ...(keyof typeof staffRoles)[]]),
  password: password.optional(),
}).strict();
const fileSchema = z.union([
  z.array(user).min(1).max(100).transform(users => ({ users, defaultPassword: undefined })),
  z.object({ defaultPassword: password, users: z.array(user).min(1).max(100) }).strict(),
]);

export function parseSeedUsers(input: unknown, demo = false) {
  const file = fileSchema.parse(input);
  const users = file.users.map(user => ({ ...user, password: password.parse(user.password ?? file.defaultPassword) }));
  if (new Set(users.map(user => user.email)).size !== users.length) throw new Error("Adresses en doublon.");
  if (!demo && users.some(user => user.email.endsWith(".test") || user.email.endsWith(".invalid"))) throw new Error("Adresses de recette interdites hors démonstration.");
  return users;
}
