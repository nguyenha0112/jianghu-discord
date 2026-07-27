require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior, AudioPlayerStatus, StreamType, getVoiceConnection } = require('@discordjs/voice');
const googleTTS = require('google-tts-api');
const fetch = require('node-fetch');
const prism = require('prism-media');

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = process.env.PREFIX || '!';

if (!TOKEN) {
  console.error('Missing DISCORD_TOKEN in .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

// Per-guild state
const guildStates = new Map();

function getState(guildId) {
  if (!guildStates.has(guildId)) {
    guildStates.set(guildId, {
      connection: null,
      player: createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } }),
      queue: [],
      textChannelId: null,
      reading: false
    });
  }
  return guildStates.get(guildId);
}

async function createResourceFromTTS(text) {
  const url = googleTTS.getAudioUrl(text, { lang: 'vi', slow: false, host: 'https://translate.google.com' });
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch tts audio');
  const stream = res.body;
  const ffmpeg = new prism.FFmpeg({
    args: [
      '-analyzeduration', '0',
      '-loglevel', '0',
      '-i', 'pipe:0',
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
      'pipe:1'
    ]
  });
  const input = stream.pipe(ffmpeg);
  return createAudioResource(input, { inputType: StreamType.Raw });
}

async function enqueueAndPlay(guildId, text) {
  const state = getState(guildId);
  state.queue.push(text);
  if (state.player.state.status === AudioPlayerStatus.Idle && !state.playing) {
    playNext(guildId);
  }
}

async function playNext(guildId) {
  const state = getState(guildId);
  const next = state.queue.shift();
  if (!next) return;
  try {
    const resource = await createResourceFromTTS(next);
    state.player.play(resource);
    state.playing = true;
  } catch (err) {
    console.error('Error creating/playing resource', err);
    state.playing = false;
    // try next
    setImmediate(() => playNext(guildId));
  }
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const guildId = message.guild?.id;
  if (!guildId) return;

  // Commands
  if (message.content.startsWith(PREFIX)) {
    const [cmd, ...rest] = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const args = rest.join(' ');
    if (cmd === 'join') {
      const member = message.member;
      const voiceChannel = member?.voice.channel;
      if (!voiceChannel) return message.reply('Bạn cần ở trong voice channel để gọi bot join.');
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: message.guild.voiceAdapterCreator
      });
      const state = getState(guildId);
      state.connection = connection;
      connection.subscribe(state.player);
      state.textChannelId = message.channel.id;
      message.reply('Đã join và sẽ đọc tin nhắn ở kênh này. Sử dụng `!leave` để rời.');
    } else if (cmd === 'leave') {
      const state = getState(guildId);
      const conn = getVoiceConnection(guildId);
      if (conn) conn.destroy();
      state.queue = [];
      state.playing = false;
      state.connection = null;
      state.textChannelId = null;
      message.reply('Đã rời voice channel.');
    } else if (cmd === 'tts') {
      const text = args;
      if (!text) return message.reply('Hãy gửi nội dung để đọc: `!tts <nội dung>`');
      const state = getState(guildId);
      if (!state.connection) return message.reply('Bot chưa được kết nối vào voice channel. Dùng `!join` trước.');
      await enqueueAndPlay(guildId, text);
      message.react('🔊').catch(() => {});
    }
    return;
  }

  // Auto-read: when bot is connected and message is in the tracked text channel
  const state = guildStates.get(guildId);
  if (state && state.connection && state.textChannelId === message.channel.id) {
    const authorName = message.member?.displayName || message.author.username;
    const content = message.content.trim();
    if (!content) return;
    const readText = `${authorName} nói: ${content}`;
    await enqueueAndPlay(guildId, readText);
  }
});

// When player becomes idle, play next
client.on('ready', () => {
  // attach player events for all guild states
  setInterval(() => {
    for (const [gid, state] of guildStates.entries()) {
      if (!state) continue;
      state.player.on(AudioPlayerStatus.Idle, () => {
        state.playing = false;
        if (state.queue.length > 0) playNext(gid);
      });
    }
  }, 2000);
});

client.login(TOKEN);
