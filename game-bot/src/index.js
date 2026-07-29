require("dotenv").config();

const { Client, Collection, Events, GatewayIntentBits } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
const { handlePvpLobbyInteraction, handleWordChainMessage } = require("./services/word-chain-service");
const {
  handleMessage: handleTaiXiuMessage,
  handleBetButtonInteraction,
  handleBetModalInteraction
} = require("./services/taixiu-service");
const {
  handleMessage: handleBauCuaMessage,
  handleButtonInteraction: handleBauCuaButtonInteraction,
  handleModalInteraction: handleBauCuaModalInteraction
} = require("./services/baucua-service");
const {
  handleMessage: handleXiDachMessage,
  handleButtonInteraction: handleXiDachButtonInteraction,
  handleModalInteraction: handleXiDachModalInteraction
} = require("./services/xidach-service");
const { handleMessage: handleVietnameseKingMessage } = require("./services/vietnamese-king-service");

const token = process.env.DISCORD_TOKEN;
const runtimeDir = path.join(__dirname, "..", "data", "runtime");
const lockFile = path.join(runtimeDir, "bot.lock");

if (!token) {
  console.error("Thieu DISCORD_TOKEN trong game-bot/.env");
  process.exit(1);
}

function ensureSingleInstance() {
  fs.mkdirSync(runtimeDir, { recursive: true });

  try {
    fs.writeFileSync(lockFile, String(process.pid), { flag: "wx" });
    return;
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }

  try {
    const existingPid = Number(fs.readFileSync(lockFile, "utf8").trim());
    if (existingPid && existingPid !== process.pid) {
      process.kill(existingPid, 0);
      console.error(`Bot dang chay o tien trinh khac (${existingPid}). Bo qua lan khoi dong nay.`);
      process.exit(1);
    }
  } catch (error) {
    fs.rmSync(lockFile, { force: true });
    fs.writeFileSync(lockFile, String(process.pid), { flag: "wx" });
  }
}

function cleanupLockFile() {
  try {
    if (!fs.existsSync(lockFile)) {
      return;
    }

    const existingPid = Number(fs.readFileSync(lockFile, "utf8").trim());
    if (!existingPid || existingPid === process.pid) {
      fs.rmSync(lockFile, { force: true });
    }
  } catch (error) {
    // Bo qua loi don lock khi thoat.
  }
}

ensureSingleInstance();

process.on("exit", cleanupLockFile);
process.on("SIGINT", () => {
  cleanupLockFile();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanupLockFile();
  process.exit(0);
});

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
    console.warn(`Bo qua command khong hop le: ${file}`);
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Jianghu Game Bot da dang nhap voi ten ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    const handled = await handlePvpLobbyInteraction(interaction).catch((error) => {
      console.error("PvP lobby interaction failed", error);
      return false;
    });
    if (handled) {
      return;
    }

    const taiXiuHandled = await handleBetButtonInteraction(interaction).catch((error) => {
      console.error("Tai Xiu button interaction failed", error);
      return false;
    });
    if (taiXiuHandled) {
      return;
    }

    const bauCuaHandled = await handleBauCuaButtonInteraction(interaction).catch((error) => {
      console.error("Bau Cua button interaction failed", error);
      return false;
    });
    if (bauCuaHandled) {
      return;
    }

    const xiDachHandled = await handleXiDachButtonInteraction(interaction).catch((error) => {
      console.error("Xi Dach button interaction failed", error);
      return false;
    });
    if (xiDachHandled) {
      return;
    }
  }

  if (interaction.isModalSubmit()) {
    const taiXiuModalHandled = await handleBetModalInteraction(interaction).catch((error) => {
      console.error("Tai Xiu modal interaction failed", error);
      return false;
    });
    if (taiXiuModalHandled) {
      return;
    }

    const bauCuaModalHandled = await handleBauCuaModalInteraction(interaction).catch((error) => {
      console.error("Bau Cua modal interaction failed", error);
      return false;
    });
    if (bauCuaModalHandled) {
      return;
    }

    const xiDachModalHandled = await handleXiDachModalInteraction(interaction).catch((error) => {
      console.error("Xi Dach modal interaction failed", error);
      return false;
    });
    if (xiDachModalHandled) {
      return;
    }
  }

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
      content: "Lenh gap loi. Kiem tra console de debug.",
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
  const finalResult =
    result ||
    (await handleVietnameseKingMessage(message)) ||
    (await handleTaiXiuMessage(message)) ||
    (await handleBauCuaMessage(message)) ||
    (await handleXiDachMessage(message));
  if (!finalResult) {
    return;
  }

  const reaction =
    finalResult.react || (finalResult.skipReaction ? null : finalResult.ok ? "success" : "failure");

  if (reaction === "success") {
    await message.react("✅").catch(() => {});
  } else if (reaction === "failure") {
    await message.react("❌").catch(() => {});
  }

  if (!finalResult.silent && (finalResult.reply || finalResult.embeds || finalResult.components)) {
    const payload = {};
    if (finalResult.reply) {
      payload.content = finalResult.reply;
    }
    if (finalResult.embeds) {
      payload.embeds = finalResult.embeds;
    }
    if (finalResult.components) {
      payload.components = finalResult.components;
    }
    await message.reply(payload).catch(() => {});
  }
});

client.login(token);
