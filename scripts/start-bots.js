const http = require("node:http");
const path = require("node:path");
const { ProcessSupervisor } = require("./process-supervisor");
const { createDiscordAdminNotifier } = require("./discord-alerts");

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name, fallback = "") {
  return process.env[name] || fallback;
}

function oneOfRequired(names) {
  for (const name of names) {
    if (process.env[name]) {
      return process.env[name];
    }
  }
  throw new Error(`Missing required environment variable. Need one of: ${names.join(", ")}`);
}

const rootDir = path.resolve(__dirname, "..");
const notifyDiscord = createDiscordAdminNotifier({
  token: process.env.DISCORD_TOKEN,
  adminUserIds: process.env.ADMIN_USER_IDS
});

const supervisor = new ProcessSupervisor({
  heartbeatTimeoutMs: Math.max(30000, Number(process.env.BOT_HEALTH_TIMEOUT_MS || 90000)),
  notify: notifyDiscord
});

const chatEnv = {
  DISCORD_TOKEN: requiredEnv("DISCORD_TOKEN_1"),
  DISCORD_CLIENT_ID: optionalEnv("DISCORD_CLIENT_ID_1"),
  DISCORD_GUILD_ID: optionalEnv("DISCORD_GUILD_ID_1", optionalEnv("DISCORD_GUILD_ID")),
  PREFIX: optionalEnv("PREFIX", "!")
};

const gameEnv = {
  DISCORD_TOKEN: requiredEnv("DISCORD_TOKEN"),
  DISCORD_CLIENT_ID: requiredEnv("DISCORD_CLIENT_ID"),
  DISCORD_GUILD_ID: requiredEnv("DISCORD_GUILD_ID"),
  SUPABASE_URL: requiredEnv("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: oneOfRequired(["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"]),
  SUPABASE_SECRET_KEY: oneOfRequired(["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"])
};

supervisor.add({ label: "chat-bot", cwd: path.join(rootDir, "chat-bot"), script: "index.js", env: chatEnv });
supervisor.add({
  label: "game-bot",
  cwd: path.join(rootDir, "game-bot"),
  script: path.join("src", "index.js"),
  env: gameEnv
});

const port = Number(process.env.PORT || 10000);
const healthServer = http.createServer((request, response) => {
  if (request.url === "/live") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, service: "jianghu-discord-suite" }));
    return;
  }
  const snapshot = supervisor.snapshot();
  response.writeHead(snapshot.ok ? 200 : 503, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ ...snapshot, service: "jianghu-discord-suite" }));
});

healthServer.listen(port, "0.0.0.0", () => console.log(`[health] listening on port ${port}`));
supervisor.startAll();

function shutdown() {
  supervisor.stop();
  healthServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
