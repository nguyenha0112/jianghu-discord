require("dotenv").config();

const {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");
const {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  joinVoiceChannel
} = require("@discordjs/voice");
const googleTTS = require("google-tts-api");
const fetch = require("node-fetch");
const prism = require("prism-media");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const PREFIX = process.env.PREFIX || "!";
const TTS_HOSTS = (process.env.TTS_HOSTS || "https://translate.google.com,https://translate.google.com.vn")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);
const TTS_SPEED = Math.min(2, Math.max(0.5, Number(process.env.TTS_SPEED || 1.2)));

if (!TOKEN) {
  console.error("[chat-bot] Missing DISCORD_TOKEN in env");
  process.exit(1);
}

const CHAT_COMMANDS = [
  new SlashCommandBuilder()
    .setName("join")
    .setDescription("Gọi bot vào voice channel hiện tại và đọc tin nhắn ở kênh này."),
  new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Cho bot rời voice channel và dừng đọc tin nhắn."),
  new SlashCommandBuilder()
    .setName("tts")
    .setDescription("Đọc nhanh một câu bằng tiếng Việt.")
    .addStringOption((option) =>
      option
        .setName("noi_dung")
        .setDescription("Nội dung muốn bot đọc")
        .setRequired(true)
        .setMaxLength(180)
    ),
  new SlashCommandBuilder()
    .setName("chatbot-trangthai")
    .setDescription("Kiểm tra trạng thái bot đọc voice.")
].map((command) => command.toJSON());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

const guildStates = new Map();

function log(message, meta = {}) {
  console.log(`[chat-bot] ${message}`, meta);
}

function assertVoiceRuntime() {
  try {
    const encoder = new prism.opus.Encoder({ rate: 48000, channels: 2, frameSize: 960 });
    encoder.destroy();
    log("voice runtime ready", { opusEncoder: true });
  } catch (error) {
    console.error("[chat-bot] Missing Opus encoder. Install opusscript or @discordjs/opus.", {
      message: error.message
    });
    process.exit(1);
  }
}

function getState(guildId) {
  if (!guildStates.has(guildId)) {
    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
    });
    const state = {
      connection: null,
      player,
      queue: [],
      textChannelId: null,
      playing: false
    };

    player.on(AudioPlayerStatus.Idle, () => {
      state.playing = false;
      if (state.queue.length > 0) {
        playNext(guildId);
      }
    });

    player.on("error", (error) => {
      state.playing = false;
      log("audio player error", { guildId, message: error.message });
      if (state.queue.length > 0) {
        playNext(guildId);
      }
    });

    guildStates.set(guildId, state);
  }

  return guildStates.get(guildId);
}

async function registerSlashCommands() {
  if (!CLIENT_ID || !GUILD_ID) {
    log("slash register skipped: missing DISCORD_CLIENT_ID or DISCORD_GUILD_ID", {
      hasClientId: Boolean(CLIENT_ID),
      hasGuildId: Boolean(GUILD_ID)
    });
    return;
  }

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: CHAT_COMMANDS
  });
  log("slash commands registered", {
    guildId: GUILD_ID,
    commands: CHAT_COMMANDS.map((command) => command.name)
  });
}

async function createResourceFromTTS(text) {
  let lastError = null;

  for (const host of TTS_HOSTS) {
    try {
      const url = googleTTS.getAudioUrl(text, { lang: "vi", slow: false, host });
      const response = await fetch(url, { timeout: 15000 });
      if (!response.ok) {
        throw new Error(`TTS HTTP ${response.status}`);
      }

      const ffmpeg = new prism.FFmpeg({
        args: [
          "-analyzeduration",
          "0",
          "-loglevel",
          "0",
          "-i",
          "pipe:0",
          "-f",
          "s16le",
          "-filter:a",
          `atempo=${TTS_SPEED}`,
          "-ar",
          "48000",
          "-ac",
          "2"
        ]
      });

      return createAudioResource(response.body.pipe(ffmpeg), {
        inputType: StreamType.Raw
      });
    } catch (error) {
      lastError = error;
      log("tts host failed", { host, message: error.message });
    }
  }

  throw lastError || new Error("Không tạo được âm thanh TTS.");
}

async function enqueueAndPlay(guildId, text) {
  const state = getState(guildId);
  state.queue.push(text.slice(0, 180));
  log("queued tts", { guildId, queueLength: state.queue.length });

  if (state.player.state.status === AudioPlayerStatus.Idle && !state.playing) {
    await playNext(guildId);
  }
}

async function playNext(guildId) {
  const state = getState(guildId);
  const next = state.queue.shift();
  if (!next) {
    return;
  }

  try {
    const resource = await createResourceFromTTS(next);
    state.player.play(resource);
    state.playing = true;
    log("playing tts", { guildId, remainingQueue: state.queue.length });
  } catch (error) {
    state.playing = false;
    log("create/play resource failed", { guildId, message: error.message });
    if (state.queue.length > 0) {
      setImmediate(() => playNext(guildId));
    }
  }
}

async function joinForContext({ guild, member, channel, user }) {
  const voiceChannel = member?.voice?.channel;
  if (!voiceChannel) {
    return { ok: false, message: "Bạn cần vào voice channel trước rồi hãy dùng `/join`." };
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false
  });
  const state = getState(guild.id);
  state.connection = connection;
  state.textChannelId = channel.id;
  connection.subscribe(state.player);

  log("joined voice", {
    guildId: guild.id,
    voiceChannelId: voiceChannel.id,
    textChannelId: channel.id,
    userId: user.id
  });

  return {
    ok: true,
    message: `Đã vào voice <#${voiceChannel.id}> và sẽ đọc tin nhắn ở <#${channel.id}>. Dùng \`/leave\` để rời.`
  };
}

function leaveGuild(guildId) {
  const state = getState(guildId);
  const connection = getVoiceConnection(guildId);
  if (connection) {
    connection.destroy();
  }

  state.queue = [];
  state.playing = false;
  state.connection = null;
  state.textChannelId = null;
  log("left voice", { guildId });
}

function buildStatusText(guildId) {
  const state = guildStates.get(guildId);
  if (!state?.connection) {
    return "Bot chưa ở trong voice channel nào. Dùng `/join` khi bạn đang ở voice.";
  }

  return [
    "Bot đang hoạt động.",
    `Kênh text đang đọc: <#${state.textChannelId}>`,
    `Queue hiện tại: ${state.queue.length} câu`,
    `Trạng thái phát: ${state.player.state.status}`
  ].join("\n");
}

async function handleChatInputCommand(interaction) {
  if (!interaction.guild) {
    await interaction.reply({ content: "Lệnh này chỉ dùng trong server.", ephemeral: true });
    return;
  }

  log("slash command received", {
    commandName: interaction.commandName,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    userId: interaction.user.id
  });

  if (interaction.commandName === "join") {
    const result = await joinForContext({
      guild: interaction.guild,
      member: interaction.member,
      channel: interaction.channel,
      user: interaction.user
    });
    await interaction.reply({ content: result.message, ephemeral: !result.ok });
    return;
  }

  if (interaction.commandName === "leave") {
    leaveGuild(interaction.guildId);
    await interaction.reply("Đã rời voice channel và dừng đọc tin nhắn.");
    return;
  }

  if (interaction.commandName === "tts") {
    const text = interaction.options.getString("noi_dung", true);
    const state = getState(interaction.guildId);
    if (!state.connection) {
      await interaction.reply({ content: "Bot chưa vào voice. Dùng `/join` trước.", ephemeral: true });
      return;
    }
    await enqueueAndPlay(interaction.guildId, text);
    await interaction.reply({ content: "Đã thêm vào hàng chờ đọc.", ephemeral: true });
    return;
  }

  if (interaction.commandName === "chatbot-trangthai") {
    await interaction.reply({ content: buildStatusText(interaction.guildId), ephemeral: true });
  }
}

async function handleTextCommand(message, cmd, args) {
  if (cmd === "join") {
    const result = await joinForContext({
      guild: message.guild,
      member: message.member,
      channel: message.channel,
      user: message.author
    });
    await message.reply(result.message);
    return true;
  }

  if (cmd === "leave") {
    leaveGuild(message.guild.id);
    await message.reply("Đã rời voice channel.");
    return true;
  }

  if (cmd === "tts") {
    if (!args) {
      await message.reply("Hãy gửi nội dung để đọc: `!tts <nội dung>` hoặc `/tts`.");
      return true;
    }

    const state = getState(message.guild.id);
    if (!state.connection) {
      await message.reply("Bot chưa được kết nối vào voice channel. Dùng `/join` trước.");
      return true;
    }

    await enqueueAndPlay(message.guild.id, args);
    await message.react("🔊").catch(() => {});
    return true;
  }

  if (cmd === "chatbot-trangthai" || cmd === "status") {
    await message.reply(buildStatusText(message.guild.id));
    return true;
  }

  return false;
}

client.once(Events.ClientReady, (readyClient) => {
  log("logged in", { tag: readyClient.user.tag });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  try {
    await handleChatInputCommand(interaction);
  } catch (error) {
    log("slash command failed", {
      commandName: interaction.commandName,
      guildId: interaction.guildId,
      userId: interaction.user?.id,
      message: error.message
    });
    const payload = { content: `Chatbot gặp lỗi: ${error.message}`, ephemeral: true };
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

  if (message.content.startsWith(PREFIX)) {
    const [cmd, ...rest] = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const handled = await handleTextCommand(message, cmd, rest.join(" "));
    if (!handled) {
      await message.reply("Lệnh chatbot chưa đúng. Dùng `/join`, `/leave`, `/tts`, `/chatbot-trangthai`.");
    }
    return;
  }

  const state = guildStates.get(message.guild.id);
  if (state?.connection && state.textChannelId === message.channel.id) {
    const content = message.content.trim();
    if (!content) {
      return;
    }

    const authorName = message.member?.displayName || message.author.username;
    await enqueueAndPlay(message.guild.id, `${authorName} nói: ${content}`);
  }
});

async function bootstrap() {
  assertVoiceRuntime();
  await registerSlashCommands().catch((error) => {
    log("slash register failed", { message: error.message });
  });
  await client.login(TOKEN);
}

bootstrap().catch((error) => {
  log("startup failed", { message: error.message });
  process.exit(1);
});
