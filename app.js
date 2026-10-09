import express from "express";
import apiRoutes from "./routes/index.js";
import { fileURLToPath } from "node:url";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { csrfGuard } from "./middlewares/security.js";
import { env } from "./config/env.js";
import { notFound, errorHandler } from "./middlewares/error-handler.js";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.length === 0 || env.corsOrigins.includes(origin))
        return callback(null, true);
      return callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use(cookieParser());
app.use(csrfGuard);
app.use(
  express.static(fileURLToPath(new URL("./public/customer/", import.meta.url)), {
    maxAge: 0,
  }),
);
app.use(
  "/admin",
  express.static(fileURLToPath(new URL("./public/admin/", import.meta.url)), {
    maxAge: 0,
  }),
);
app.use("/api", apiRoutes);

app.use(notFound);
app.use(errorHandler);
