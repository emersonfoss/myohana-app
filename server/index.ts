import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { logger } from "./logger";
import { startScheduler } from "./scheduler";

const app = express();
app.set('trust proxy', 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ─── CORS ──────────────────────────────────────────────────────────
const corsOrigin =
  process.env.NODE_ENV === "production"
    ? process.env.APP_URL || false
    : true;

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);

// ─── Body Parsing ──────────────────────────────────────────────────
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// ─── Request Logging (pino-http) ───────────────────────────────────
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => (req as any).url === "/api/health",
    },
  }),
);

// ─── Unhandled Rejection / Exception Handlers ──────────────────────
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — shutting down");
  process.exit(1);
});

(async () => {
  const { wss } = await registerRoutes(httpServer, app);

  // ─── Global Error Handler ──────────────────────────────────────────
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message =
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal Server Error";

    logger.error({ err, status }, "Request error");

    if (res.headersSent) {
      return;
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      logger.info(`MyOhana server listening on port ${port}`);

      // Start the scheduled job runner (non-blocking — failure doesn't crash the server)
      startScheduler().catch((err) => {
        logger.error({ err }, "Scheduler failed to start");
      });
    },
  );

  // ─── Graceful Shutdown ─────────────────────────────────────────────
  function shutdown(signal: string) {
    logger.info(`${signal} received, shutting down gracefully...`);
    httpServer.close(() => {
      wss.close(() => {
        logger.info("WebSocket server closed");
      });
      logger.info("HTTP server closed");
      process.exit(0);
    });
    // Force exit after 10s if graceful shutdown fails
    setTimeout(() => {
      logger.error("Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, 10000);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
