require("dotenv").config();

const { claimDaily, getProfile } = require("../services/game-service");

async function main() {
  const testUserId = "test-user-supabase";
  const testUsername = "SupabaseTester";

  const dailyResult = await claimDaily(testUserId, testUsername);
  console.log("daily:", dailyResult.message);

  const profile = await getProfile(testUserId, testUsername);
  console.log(
    JSON.stringify(
      {
        userId: profile.userId,
        username: profile.username,
        xu: profile.wallet.xu,
        ngoc: profile.wallet.ngoc,
        playerLevel: profile.stats.playerLevel,
        playerXp: profile.stats.playerXp
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Test game flow thất bại:", error);
  process.exit(1);
});
