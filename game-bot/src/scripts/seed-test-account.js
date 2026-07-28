const { ensurePlayer, getPlayer, updatePlayer } = require("../storage/player-store");

const userId = process.argv[2] || "757257684616609802";
const username = process.argv[3] || "Test User";

async function main() {
  await ensurePlayer(userId, username);
  const current = await getPlayer(userId);

  const updated = await updatePlayer(userId, {
    username,
    wallet: {
      ...current.wallet,
      xu: 50000,
      ngoc: 500
    },
    stats: {
      ...current.stats,
      playerLevel: 15,
      playerXp: 40,
      totalXuEarned: Math.max(current.stats.totalXuEarned, 50000),
      totalNgocEarned: Math.max(current.stats.totalNgocEarned, 500),
      totalWorkActions: Math.max(current.stats.totalWorkActions, 25),
      totalItemsSold: Math.max(current.stats.totalItemsSold, 10)
    },
    inventory: {
      ...current.inventory,
      river_fish: 20,
      iron_ore: 20,
      herb_bundle: 20,
      wild_herb: 25,
      forest_fiber: 18,
      moon_flower: 8,
      catalyst_powder: 12,
      minor_elixir: 6,
      refined_essence: 4,
      relic_fragment: 6,
      sealed_relic: 3,
      spirit_stone: 10,
      foundation_pill: 2,
      spirit_core: 1,
      alchemy_essence: 10,
      ancient_fragment: 8
    },
    profession: {
      current: "fishing",
      xp: 60,
      levels: {
        ...current.profession.levels,
        fishing: 10,
        mining: 8,
        gathering: 8,
        alchemy: 7,
        archaeology: 2
      }
    },
    cultivation: {
      realm: "pham_nhan",
      realmIndex: 0
    }
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        userId: updated.userId,
        username: updated.username,
        wallet: updated.wallet,
        stats: updated.stats,
        profession: updated.profession
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Seed test account failed:", error);
  process.exit(1);
});
