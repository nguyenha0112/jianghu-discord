require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { REST, Routes } = require("discord.js");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error("Thieu DISCORD_TOKEN, DISCORD_CLIENT_ID hoac DISCORD_GUILD_ID trong game-bot/.env");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);

function loadCommandData() {
  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));

  return commandFiles
    .map((file) => require(path.join(commandsPath, file)))
    .filter((command) => command?.data?.toJSON)
    .map((command) => command.data.toJSON());
}

async function main() {
  const commandData = loadCommandData();
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
