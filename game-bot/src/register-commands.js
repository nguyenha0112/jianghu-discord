require("dotenv").config();

const { REST, Routes } = require("discord.js");
const { commandData } = require("./shared/command-registry");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error("Thieu DISCORD_TOKEN, DISCORD_CLIENT_ID hoac DISCORD_GUILD_ID trong game-bot/.env");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);

async function main() {
  console.log(`Dang dang ky ${commandData.length} guild commands...`);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commandData
  });
  console.log("Dang ky guild commands thanh cong.");
}

main().catch((error) => {
  console.error("Dang ky commands that bai", error);
  process.exit(1);
});
