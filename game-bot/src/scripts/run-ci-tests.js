const { spawnSync } = require("node:child_process");

const scripts = [
  "check",
  "check:register",
  "commands:test",
  "catalog:test",
  "economy:test",
  "keepalive:test",
  "dashboard:test",
  "recovery:test",
  "wordchain:test",
  "wordchain:dict:test",
  "vttv:test",
  "vttv:rotation:test",
  "taixiu:test",
  "xidach:test",
  "rps:test",
  "quiz:test",
  "serverlog:test"
];

for (const script of scripts) {
  console.log(`\n[verify] npm run ${script}`);
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      SUPABASE_SECRET_KEY: "",
      SUPABASE_PUBLISHABLE_KEY: ""
    },
    stdio: "inherit"
  });
  if (result.status !== 0) {
    console.error(`[verify] Thất bại tại ${script}`);
    process.exit(result.status || 1);
  }
}

console.log(`\n[verify] PASS ${scripts.length} nhóm kiểm tra game bot.`);
