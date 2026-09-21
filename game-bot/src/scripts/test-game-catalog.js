const assert = require("node:assert/strict");
const catalog = require("../config/game-catalog.json");

assert.equal(catalog.schemaVersion, 1);
assert.ok(Array.isArray(catalog.games) && catalog.games.length >= 5);
const keys = catalog.games.map((game) => game.key);
assert.equal(new Set(keys).size, keys.length, "Game key must be unique");
for (const game of catalog.games) {
  assert.ok(game.name && game.entry && game.controls && game.rewardPolicy, `Missing metadata for ${game.key}`);
  assert.ok(["live", "planned", "paused"].includes(game.status), `Invalid status for ${game.key}`);
  if (game.visual) {
    assert.equal(game.visual.format, "png", `${game.key} visual must use PNG`);
    assert.ok(game.visual.width <= 1200 && game.visual.height <= 675, `${game.key} visual is too large`);
  }
}
console.log(JSON.stringify({ ok: true, games: catalog.games.length, live: catalog.games.filter((game) => game.status === "live").length }, null, 2));
