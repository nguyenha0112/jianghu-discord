const { spawn } = require("node:child_process");

class ProcessSupervisor {
  constructor({ heartbeatTimeoutMs = 90000, notify = async () => {}, spawnProcess = spawn } = {}) {
    this.heartbeatTimeoutMs = heartbeatTimeoutMs;
    this.notify = notify;
    this.spawnProcess = spawnProcess;
    this.services = new Map();
    this.stopping = false;
  }

  add(definition) {
    this.services.set(definition.label, {
      ...definition, child: null, ready: false, health: {}, lastHeartbeatAt: 0,
      restarts: 0, restartTimer: null
    });
  }

  startAll() {
    for (const service of this.services.values()) this.start(service);
  }

  start(service) {
    console.log(`[launcher] starting ${service.label}`, { cwd: service.cwd, script: service.script });
    const child = this.spawnProcess(process.execPath, [service.script], {
      cwd: service.cwd,
      env: { ...process.env, ...service.env },
      stdio: ["inherit", "inherit", "inherit", "ipc"]
    });
    service.child = child;
    service.ready = false;
    service.health = {};
    service.lastHeartbeatAt = Date.now();
    child.on("message", (message) => this.handleMessage(service, message));
    child.on("error", (error) => console.error(`[${service.label}] failed`, { message: error.message }));
    child.on("exit", (code, signal) => this.handleExit(service, code, signal));
  }

  handleMessage(service, message) {
    if (!message || message.type !== "bot-health") return;
    const wasReady = service.ready;
    const previousSupabase = service.health.supabaseReady;
    service.health = { ...message };
    service.ready = Boolean(message.discordReady) && message.supabaseReady !== false;
    service.lastHeartbeatAt = Date.now();
    service.restarts = 0;
    if (!wasReady && service.ready) this.notify(`${service.label} đã kết nối và hoạt động bình thường.`).catch(() => {});
    if (previousSupabase !== false && message.supabaseReady === false) {
      this.notify(`${service.label} mất kết nối Supabase. Hệ thống đang chờ tự phục hồi.`).catch(() => {});
    }
    if (previousSupabase === false && message.supabaseReady === true) {
      this.notify(`${service.label} đã kết nối lại Supabase.`).catch(() => {});
    }
  }

  handleExit(service, code, signal) {
    service.child = null;
    service.ready = false;
    service.health = { exitCode: code, signal };
    console.error(`[${service.label}] exited`, { code, signal });
    if (this.stopping) return;
    service.restarts += 1;
    const delay = Math.min(30000, 2000 * 2 ** Math.min(service.restarts - 1, 4));
    this.notify(`${service.label} đã dừng và sẽ tự khởi động lại sau ${Math.round(delay / 1000)} giây.`).catch(() => {});
    clearTimeout(service.restartTimer);
    service.restartTimer = setTimeout(() => this.start(service), delay);
  }

  snapshot(now = Date.now()) {
    const services = {};
    let ok = this.services.size > 0;
    for (const [label, service] of this.services) {
      const heartbeatAgeMs = service.lastHeartbeatAt ? now - service.lastHeartbeatAt : null;
      const alive = Boolean(service.child && service.child.exitCode === null && !service.child.killed);
      const heartbeatFresh = heartbeatAgeMs !== null && heartbeatAgeMs <= this.heartbeatTimeoutMs;
      const serviceOk = alive && heartbeatFresh && service.ready;
      ok = ok && serviceOk;
      services[label] = {
        ok: serviceOk, alive, heartbeatFresh, heartbeatAgeMs, restarts: service.restarts,
        discordReady: Boolean(service.health.discordReady),
        supabaseReady: service.health.supabaseReady ?? null
      };
    }
    return { ok, services };
  }

  stop() {
    this.stopping = true;
    for (const service of this.services.values()) {
      clearTimeout(service.restartTimer);
      service.child?.kill("SIGTERM");
    }
  }
}

module.exports = { ProcessSupervisor };
