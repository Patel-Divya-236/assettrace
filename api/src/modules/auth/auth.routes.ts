import { Router } from "express";
import { currentUser, requireAuth } from "../../middleware/auth";
import { loginLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import { loginBody, signupBody } from "./auth.schema";
import * as authService from "./auth.service";

export const authRouter = Router();

authRouter.post("/login", loginLimiter, validate({ body: loginBody }), async (req, res) => {
  res.json(await authService.login(req.body));
});

authRouter.post("/signup", loginLimiter, validate({ body: signupBody }), async (req, res) => {
  res.status(201).json(await authService.signup(req.body));
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: await authService.getMe(currentUser(req).id) });
});
