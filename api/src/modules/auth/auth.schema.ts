import { z } from "zod";

const phone = z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number");

// Staff log in with email, citizens with their mobile number; one field for both.
export const loginBody = z.object({
  login: z
    .string({ error: "Enter your email or mobile number" })
    .trim()
    .min(1, "Enter your email or mobile number")
    .transform((s) => s.toLowerCase()),
  password: z.string({ error: "Enter your password" }).min(1, "Enter your password"),
});

// Public sign-up creates a CITIZEN account only. Staff accounts are created by an admin.
export const signupBody = z.object({
  name: z.string({ error: "Enter your name" }).trim().min(2, "Enter your name"),
  phone,
  password: z.string({ error: "Choose a password" }).min(6, "Password must be at least 6 characters"),
});

export type LoginBody = z.infer<typeof loginBody>;
export type SignupBody = z.infer<typeof signupBody>;
