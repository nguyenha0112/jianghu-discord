const assert = require("node:assert/strict");
const { commandData } = require("../shared/command-registry");

const names = commandData.map((command) => command.name);
const retiredCultivationCommands = ["tutien", "dotpha", "dongphu", "phapbao", "bicanh"];
const requiredCoreCommands = ["profile", "daily", "choose-profession", "work", "inventory", "wallet", "admin"];

assert.equal(new Set(names).size, names.length, "Slash command registry contains duplicates");
for (const name of retiredCultivationCommands) assert.ok(!names.includes(name), `${name} must be hidden`);
for (const name of requiredCoreCommands) assert.ok(names.includes(name), `${name} must remain available`);
const admin = commandData.find((command) => command.name === "admin");
const adminActions = admin.options?.find((option) => option.name === "hanh_dong")?.choices || [];
assert.ok(adminActions.length <= 25, "Discord allows at most 25 admin action choices");
assert.ok(adminActions.some((choice) => choice.value === "system_status"), "Admin dashboard action must remain available");
console.log(JSON.stringify({ ok: true, commandCount: names.length, hidden: retiredCultivationCommands, core: requiredCoreCommands }, null, 2));
