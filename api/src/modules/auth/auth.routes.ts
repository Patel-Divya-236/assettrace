import { Router } from "express";
import { currentUser, requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { loginBody } from "./auth.schema";
import * as authService from "./auth.service";

export const authRouter = Router();

authRouter.post("/login", validate({ body: loginBody }), async (req, res) => {
  res.json(await authService.login(req.body));
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: await authService.getMe(currentUser(req).id) });
});
