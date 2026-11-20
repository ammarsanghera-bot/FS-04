import { Router } from "express";
import multer from "multer";
import { env } from "../../config/env.js";
import { authenticate } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import * as auth from "./auth.controller.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_UPLOAD_BYTES } });
const limited = rateLimit(20, 15 * 60 * 1000);

export const authRouter = Router();

authRouter.post("/register", limited, auth.register);
authRouter.post("/login", limited, auth.login);
authRouter.post("/logout", auth.logout);
authRouter.post("/refresh", auth.refresh);
authRouter.post("/forgot-password", limited, auth.forgotPassword);
authRouter.post("/reset-password", limited, auth.resetPassword);
authRouter.post("/verify-email", auth.verifyEmail);
authRouter.post("/resend-verification", authenticate, auth.resendVerification);
authRouter.get("/me", authenticate, auth.me);
authRouter.patch("/me", authenticate, auth.updateProfile);
authRouter.post("/change-password", authenticate, auth.changePassword);
authRouter.get("/sessions", authenticate, auth.listSessions);
authRouter.delete("/sessions/:sessionId", authenticate, auth.revokeSession);
authRouter.post("/avatar", authenticate, upload.single("file"), auth.uploadAvatar);
authRouter.get("/avatars/:userId", authenticate, auth.getAvatar);
