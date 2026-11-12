import { createApp } from "./app.js";

if (
  process.env.INVESTIGATOR_MODE &&
  process.env.INVESTIGATOR_MODE !== "scripted"
)
  throw new Error(
    "Only INVESTIGATOR_MODE=scripted is supported. No external AI provider is enabled.",
  );
const port = Number(process.env.PORT ?? 8080);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be between 1 and 65535");
const server = createApp().listen(port, "0.0.0.0", () =>
  console.log(`ShopSphere listening on ${port} (synthetic demo)`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
