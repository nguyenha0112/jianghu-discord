require("dotenv").config();

const { Client, Collection, Events, GatewayIntentBits } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
const { handleWordChainMessage } = require("./services/word-chain-service");

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("Thiếu DISCORD_TOKEN trong game-bot/.env");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`Bỏ qua command không hợp lệ: ${file}`);
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Jianghu Game Bot đã đăng nhập với tên ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Command failed: ${interaction.commandName}`, error);
    const payload = {
      content: "Lệnh gặp lỗi. Kiểm tra console để debug.",
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) {
    return;
  }

  const result = await handleWordChainMessage(message);
  if (!result) {
    return;
  }

  if (!result.skipReaction) {
    if (result.ok) {
      await message.react("✅").catch(() => {});
    } else {
      await message.react("❌").catch(() => {});
    }
  }

  if (result.reply && !result.silent) {
    await message.reply(result.reply).catch(() => {});
  }
});

client.login(token);
