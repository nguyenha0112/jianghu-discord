const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { ProcessSupervisor } = require("./process-supervisor");

class FakeChild extends EventEmitter {
  constructor() { super(); this.exitCode = null; this.killed = false; }
  kill() { this.killed = true; }
}

const children = [];
const supervisor = new ProcessSupervisor({
  heartbeatTimeoutMs: 1000,
  spawnProcess: () => { const child = new FakeChild(); children.push(child); return child; }
});
supervisor.add({ label: "game-bot", cwd: ".", script: "bot.js", env: {} });
supervisor.startAll();
assert.equal(supervisor.snapshot().ok, false);
children[0].emit("message", { type: "bot-health", discordReady: true, supabaseReady: true });
assert.equal(supervisor.snapshot().ok, true);
assert.equal(supervisor.snapshot(Date.now() + 2000).ok, false);
children[0].exitCode = 1;
children[0].emit("exit", 1, null);
assert.equal(supervisor.snapshot().services["game-bot"].alive, false);
supervisor.stop();
console.log("PASS: health heartbeat, stale detection, exit detection and shutdown");
