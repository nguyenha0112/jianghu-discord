const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

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

function startProcess(label, cwd, script, env) {
  console.log(`[launcher] starting ${label}`, { cwd, script });
  const child = spawn(process.execPath, [script], {
    cwd,
    env: { ...process.env, ...env },
    stdio: "inherit"
  });

  child.on("exit", (code, signal) => {
    console.error(`[${label}] exited`, { code, signal });
    process.exitCode = code || 1;
  });

  child.on("error", (error) => {
    console.error(`[${label}] failed to start`, { message: error.message });
    process.exitCode = 1;
  });

  return child;
}

const rootDir = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 10000);
const healthServer = http.createServer((request, response) => {
  const payload = {
    ok: true,
    service: "jianghu-discord-game",
    bots: ["chat-bot", "game-bot"]
  };

  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
});

healthServer.listen(port, "0.0.0.0", () => {
  console.log(`[health] listening on port ${port}`);
});

const chatEnv = {
  DISCORD_TOKEN: requiredEnv("DISCORD_TOKEN_1"),
  DISCORD_CLIENT_ID: optionalEnv("DISCORD_CLIENT_ID_1"),
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

startProcess("chat-bot", path.join(rootDir, "chat-bot"), "index.js", chatEnv);
startProcess("game-bot", path.join(rootDir, "game-bot"), path.join("src", "index.js"), gameEnv);
