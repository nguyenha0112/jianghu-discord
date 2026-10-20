const assert = require("node:assert/strict");
const catalog = require("../config/game-catalog.json");
const { policies, getEconomyPolicy } = require("../config/economy-policies");

function walkNumbers(value, path = "policy") {
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (typeof child === "number") {
      assert.ok(Number.isFinite(child) && child >= 0, `${childPath} must be a non-negative number`);
    } else if (child && typeof child === "object") {
      walkNumbers(child, childPath);
    }
  }
}

for (const [key, policy] of Object.entries(policies)) walkNumbers(policy, key);
for (const game of catalog.games) assert.equal(getEconomyPolicy(game.rewardPolicy), policies[game.rewardPolicy]);
assert.throws(() => getEconomyPolicy("missing-policy"), /không tồn tại/);
assert.ok(Object.isFrozen(policies["betting-v1"]), "Policies must be immutable at runtime");
console.log(JSON.stringify({ ok: true, policies: Object.keys(policies).length, gamesCovered: catalog.games.length, immutable: true, invalidPolicyRejected: true }, null, 2));
