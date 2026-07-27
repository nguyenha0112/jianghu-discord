require("dotenv").config();

const { REST, Routes } = require("discord.js");
const { commandData } = require("./shared/command-registry");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error("Thiếu DISCORD_TOKEN, DISCORD_CLIENT_ID hoặc DISCORD_GUILD_ID trong game-bot/.env");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);

async function main() {
  console.log(`Đang đăng ký ${commandData.length} guild commands...`);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commandData
  });
  console.log("Đăng ký guild commands thành công.");
}

main().catch((error) => {
  console.error("Đăng ký commands thất bại", error);
  process.exit(1);
});
