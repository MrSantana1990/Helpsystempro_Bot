import { router } from "./trpc.js";
import { authRouter } from "./routers/auth.js";
import { adminRouter } from "./routers/admin.js";

export const appRouter = router({
  auth: authRouter,
  admin: adminRouter
});

export type AppRouter = typeof appRouter;

