import { z } from "zod";

export const loginBody = z.object({
  email: z.email({ message: "Enter a valid email address" }).transform((e) => e.toLowerCase()),
  password: z.string({ error: "Enter your password" }).min(1, "Enter your password"),
});

export type LoginBody = z.infer<typeof loginBody>;
