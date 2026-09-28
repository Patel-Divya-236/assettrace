import { Prisma, type User } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { AppError } from "../../lib/AppError";
import type { LoginBody, SignupBody } from "./auth.schema";

const publicUser = { id: true, name: true, email: true, phone: true, role: true } as const;

function session(user: User) {
  const token = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
  return { token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } };
}

export async function login({ login, password }: LoginBody) {
  // 10 digits = mobile number (citizens); anything else = email (staff).
  const where = /^\d{10}$/.test(login) ? { phone: login } : { email: login };
  const user = await prisma.user.findUnique({ where });

  // Same message for unknown account and wrong password, so nobody can use the
  // login form to find out which emails or numbers are registered.
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !ok) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email/mobile number or password is incorrect.");
  }
  return session(user);
}

/** Citizen sign-up: creates a CITIZEN account and logs it in. */
export async function signup({ name, phone, password }: SignupBody) {
  try {
    const user = await prisma.user.create({
      data: { name, phone, role: "CITIZEN", passwordHash: await bcrypt.hash(password, 10) },
    });
    return session(user);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppError(409, "PHONE_TAKEN", "This mobile number is already registered. Please log in.");
    }
    throw err;
  }
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUser });
  if (!user) throw new AppError(401, "UNAUTHENTICATED", "Please log in to continue.");
  return user;
}
