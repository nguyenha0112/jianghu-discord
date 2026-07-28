const { attemptBreakthrough, chooseProfession, getCultivationStatus } = require("../services/game-service");
const { ensurePlayer, getPlayer, updatePlayer } = require("../storage/player-store");

async function main() {
  const userId = "test-breakthrough-user";
  const username = "BreakthroughTester";

  await ensurePlayer(userId, username);
  await chooseProfession(userId, username, "alchemy");

  const current = await getPlayer(userId);
  await updatePlayer(userId, {
    username,
    wallet: {
      ...current.wallet,
      xu: 5000
    },
    inventory: {
      ...current.inventory,
      minor_elixir: 3,
      spirit_stone: 5
    },
    profession: {
      ...current.profession,
      current: "alchemy",
      xp: 0,
      levels: {
        ...current.profession.levels,
        alchemy: 10
      }
    },
    cultivation: {
      realm: "pham_nhan",
      realmIndex: 0
    }
  });

  const before = await getCultivationStatus(userId, username);
  const result = await attemptBreakthrough(userId, username);
  const after = await getCultivationStatus(userId, username);

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        beforeRealm: before.currentRealm.name,
        afterRealm: after.currentRealm.name,
        message: result.message
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Breakthrough test failed:", error);
  process.exit(1);
});
