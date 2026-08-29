require("dotenv").config();

const { Client, Collection, Events, GatewayIntentBits } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
const { hydrateRooms: hydrateWordChainRooms } = require("./storage/word-chain-room-store");
const { hydrateRooms: hydrateTaiXiuRooms } = require("./storage/taixiu-room-store");
const { hydrateRooms: hydrateBauCuaRooms } = require("./storage/baucua-room-store");
const { hydrateRooms: hydrateVietnameseKingRooms } = require("./storage/vietnamese-king-room-store");
const { hydrateRooms: hydrateXiDachRooms } = require("./storage/xidach-room-store");
const { hydrateRooms: hydrateLevelUpRooms } = require("./storage/levelup-room-store");
const { hydrateRooms: hydrateServerLogRooms } = require("./storage/serverlog-room-store");
const { announceMemberLeave } = require("./lib/serverlog-announcer");
const { hasSupabaseConfig } = require("./lib/supabase");
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
const enableMemberLogs = ["1", "true", "yes", "on"].includes(
  String(process.env.DISCORD_ENABLE_MEMBER_LOGS || "").toLowerCase()
);
const runtimeDir = path.join(__dirname, "..", "data", "runtime");
const lockFile = path.join(runtimeDir, "bot.lock");

function logStartup(message, meta = {}) {
  console.log(`[startup] ${message}`, meta);
}

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

const clientIntents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent
];

if (enableMemberLogs) {
  clientIntents.push(GatewayIntentBits.GuildMembers);
}

const client = new Client({
  intents: clientIntents
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
logStartup("commands loaded", { count: client.commands.size });

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Jianghu Game Bot đã đăng nhập với tên ${readyClient.user.tag}`);
  if (!enableMemberLogs) {
    console.warn("[serverlog] member leave logs disabled. Set DISCORD_ENABLE_MEMBER_LOGS=true after enabling SERVER MEMBERS INTENT in Discord Developer Portal.");
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  if (!enableMemberLogs) {
    return;
  }
  console.log("[serverlog] member remove event", {
    guildId: member.guild.id,
    userId: member.user.id,
    username: member.user.username
  });
  await announceMemberLeave(member).catch((error) => {
    console.error("[serverlog] member leave handler failed", {
      guildId: member.guild.id,
      userId: member.user.id,
      message: error.message
    });
  });
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
    console.warn("[interaction] command not found", { commandName: interaction.commandName, userId: interaction.user?.id });
    return;
  }

  try {
    console.log("[interaction] command start", {
      commandName: interaction.commandName,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      userId: interaction.user.id
    });
    await command.execute(interaction);
    console.log("[interaction] command success", {
      commandName: interaction.commandName,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      userId: interaction.user.id
    });
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

  let handlerName = "word-chain";
  let finalResult = await handleWordChainMessage(message);
  if (!finalResult) {
    handlerName = "vietnamese-king";
    finalResult = await handleVietnameseKingMessage(message);
  }
  if (!finalResult) {
    handlerName = "taixiu";
    finalResult = await handleTaiXiuMessage(message);
  }
  if (!finalResult) {
    handlerName = "baucua";
    finalResult = await handleBauCuaMessage(message);
  }
  if (!finalResult) {
    handlerName = "xidach";
    finalResult = await handleXiDachMessage(message);
  }
  if (!finalResult) {
    return;
  }

  console.log("[message] handled", {
    handler: handlerName,
    ok: Boolean(finalResult.ok),
    silent: Boolean(finalResult.silent),
    guildId: message.guild.id,
    channelId: message.channel.id,
    userId: message.author.id
  });

  const reaction =
    finalResult.react || (finalResult.skipReaction ? null : finalResult.ok ? "success" : "failure");

  if (reaction === "success") {
    await message.react("✅").catch(() => {});
  } else if (reaction === "failure") {
    await message.react("❌").catch(() => {});
  }

  if (!finalResult.silent && (finalResult.reply || finalResult.embeds || finalResult.components || finalResult.files)) {
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
    if (finalResult.files) {
      payload.files = finalResult.files;
    }
    await message.reply(payload).catch(() => {});
  }
});

async function bootstrap() {
  logStartup("hydrating room config");
  await Promise.all([
    hydrateWordChainRooms(),
    hydrateTaiXiuRooms(),
    hydrateBauCuaRooms(),
    hydrateVietnameseKingRooms(),
    hydrateXiDachRooms(),
    hydrateLevelUpRooms(),
    hydrateServerLogRooms()
  ]);
  logStartup("room config hydrated");

  logStartup("logging in Discord", {
    commands: client.commands.size,
    guildId: process.env.DISCORD_GUILD_ID || null,
    supabaseConfigured: hasSupabaseConfig(),
    guildMembersIntent: enableMemberLogs
  });
  await client.login(token);
}

bootstrap().catch((error) => {
  console.error("Khoi dong Jianghu Game Bot that bai:", error);
  cleanupLockFile();
  process.exit(1);
});
