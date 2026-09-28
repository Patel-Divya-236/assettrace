import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { AppError } from "../../lib/AppError";
import type { LoginBody } from "./auth.schema";

const publicUser = { id: true, name: true, email: true, role: true } as const;

export async function login({ email, password }: LoginBody) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Same message for unknown email and wrong password, so nobody can use the
  // login form to find out which emails exist.
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !ok) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUser });
  if (!user) throw new AppError(401, "UNAUTHENTICATED", "Please log in to continue.");
  return user;
}
