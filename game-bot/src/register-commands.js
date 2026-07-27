require("dotenv").config();

const { REST, Routes } = require("discord.js");
const { commandData } = require("./shared/command-registry");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error("Missing DISCORD_TOKEN, DISCORD_CLIENT_ID, or DISCORD_GUILD_ID in game-bot/.env");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);

async function main() {
  console.log(`Registering ${commandData.length} guild commands...`);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commandData
  });
  console.log("Guild commands registered successfully.");
}

main().catch((error) => {
  console.error("Failed to register commands", error);
  process.exit(1);
});
