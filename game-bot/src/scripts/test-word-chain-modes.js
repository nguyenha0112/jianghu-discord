const { enableRoom, disableRoom } = require("../storage/word-chain-room-store");
const {
  findPlayablePhraseForToken,
  getSessionStatus,
  handleWordChainMessage,
  stopSession
} = require("../services/word-chain-service");

class FakeSentMessage {
  constructor(id, payload) {
    this.id = id;
    this.payload = payload;
  }

  async edit(payload) {
    this.payload = payload;
    return this;
  }
}

class FakeChannel {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.sent = [];
    this._messages = new Map();
    this.messages = {
      fetch: async (messageId) => {
        const message = this._messages.get(messageId);
        if (!message) {
          throw new Error(`Message ${messageId} not found`);
        }
        return message;
      }
    };
  }

  async send(payload) {
    const message = new FakeSentMessage(`${this.id}-${this.sent.length + 1}`, payload);
    this.sent.push(message);
    this._messages.set(message.id, message);
    return message;
  }
}

function createMessage(channel, guildId, content, userId, username) {
  return {
    content,
    channel,
    guild: { id: guildId },
    author: { id: userId, username, bot: false }
  };
}

async function runPvpFlow() {
  const channelId = "test-pvp-room";
  disableRoom(channelId);
  stopSession(channelId);
  enableRoom(channelId, {
    guildId: "guild-1",
    channelName: "pvp-room",
    mode: "pvp",
    createdByUserId: "admin",
    createdByUsername: "Admin"
  });

  const channel = new FakeChannel(channelId, "pvp-room");
  const startResult = await handleWordChainMessage(createMessage(channel, "guild-1", "!batdau", "u1", "Alice"));
  if (!startResult?.ok) {
    throw new Error("PvP start failed");
  }

  const sessionAfterStart = getSessionStatus(channelId);
  const validReply = findPlayablePhraseForToken(sessionAfterStart.requiredToken, "guild-1", [sessionAfterStart.currentPhrase]);
  if (!validReply) {
    throw new Error("PvP could not find a valid reply");
  }

  const playResult = await handleWordChainMessage(createMessage(channel, "guild-1", validReply, "u2", "Bob"));
  if (!playResult?.ok) {
    throw new Error("PvP valid move rejected");
  }

  stopSession(channelId);
  disableRoom(channelId);
  return { firstPhrase: sessionAfterStart.currentPhrase, acceptedReply: validReply };
}

async function runPveFlow() {
  const channelId = "test-pve-room";
  disableRoom(channelId);
  stopSession(channelId);
  enableRoom(channelId, {
    guildId: "guild-2",
    channelName: "pve-room",
    mode: "pve",
    createdByUserId: "admin",
    createdByUsername: "Admin"
  });

  const channel = new FakeChannel(channelId, "pve-room");
  const startResult = await handleWordChainMessage(createMessage(channel, "guild-2", "!play", "u3", "Carol"));
  if (!startResult?.ok) {
    throw new Error("PvE start failed");
  }

  const sessionAfterStart = getSessionStatus(channelId);
  const validReply = findPlayablePhraseForToken(sessionAfterStart.requiredToken, "guild-2", [sessionAfterStart.currentPhrase]);
  if (!validReply) {
    throw new Error("PvE could not find a valid reply");
  }

  const playResult = await handleWordChainMessage(createMessage(channel, "guild-2", validReply, "u3", "Carol"));
  if (!playResult?.ok || playResult.react !== "success") {
    throw new Error("PvE valid move rejected");
  }

  stopSession(channelId);
  disableRoom(channelId);
  return { acceptedReply: validReply };
}

async function runTimeoutFlow() {
  const channelId = "test-timeout-room";
  disableRoom(channelId);
  stopSession(channelId);
  enableRoom(channelId, {
    guildId: "guild-5",
    channelName: "timeout-room",
    mode: "pvp",
    createdByUserId: "admin",
    createdByUsername: "Admin"
  });

  const channel = new FakeChannel(channelId, "timeout-room");
  await handleWordChainMessage(createMessage(channel, "guild-5", "!batdau", "u10", "Jade"));
  const beforeTimeout = getSessionStatus(channelId);
  const previousPhrase = beforeTimeout.currentPhrase;
  const timeoutHandler = beforeTimeout.turnTimer._onTimeout;
  clearTimeout(beforeTimeout.turnTimer);
  await timeoutHandler();

  const afterTimeout = getSessionStatus(channelId);
  if (afterTimeout) {
    throw new Error("Timeout flow should end the current session");
  }

  disableRoom(channelId);
  return { previousPhrase, sessionEnded: true };
}

async function runTextCommandFlow() {
  const channelId = "test-command-room";
  disableRoom(channelId);
  stopSession(channelId);
  enableRoom(channelId, {
    guildId: "guild-6",
    channelName: "command-room",
    mode: "pvp",
    createdByUserId: "admin",
    createdByUsername: "Admin"
  });

  const channel = new FakeChannel(channelId, "command-room");
  const unknownResult = await handleWordChainMessage(createMessage(channel, "guild-6", "!abc", "u11", "Kira"));
  if (unknownResult?.ok || !unknownResult?.reply?.includes("!batdau")) {
    throw new Error("Unknown command did not return help");
  }

  const playResult = await handleWordChainMessage(createMessage(channel, "guild-6", "!play", "u11", "Kira"));
  if (!playResult?.ok) {
    throw new Error("!play did not start a new round");
  }

  const runningPlayResult = await handleWordChainMessage(createMessage(channel, "guild-6", "!play", "u11", "Kira"));
  if (!runningPlayResult?.ok || !runningPlayResult?.reply?.includes("!stop")) {
    throw new Error("!play while running did not explain current session");
  }

  const stopResult = await handleWordChainMessage(createMessage(channel, "guild-6", "!stop", "u11", "Kira"));
  if (!stopResult?.ok || !stopResult?.reply?.includes("Đã kết thúc")) {
    throw new Error("!stop did not end the current session");
  }

  stopSession(channelId);
  disableRoom(channelId);
  return { unknownCommandHelp: true, playStartsNewRound: true, stopEndsRound: true };
}

async function main() {
  const pvp = await runPvpFlow();
  const pve = await runPveFlow();
  const timeout = await runTimeoutFlow();
  const textCommands = await runTextCommandFlow();

  console.log(JSON.stringify({ ok: true, pvp, pve, timeout, textCommands }, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error("Word-chain mode test failed:", error);
  process.exit(1);
});
