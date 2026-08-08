const { disableRoom, enableRoom } = require("../storage/word-chain-room-store");
const {
  maybeAwardPvpCheckpoint,
  countAvailableFollowups,
  distributeFinalRewards,
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
  const startResult = await handleWordChainMessage(createMessage(channel, "guild-1", "!play", "u1", "Alice"));
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

  const secondSession = getSessionStatus(channelId);
  if ((secondSession.scores.get("u2") || 0) !== 1) {
    throw new Error("PvP score was not recorded");
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
    throw new Error(
      `PvE valid move rejected | seed=${sessionAfterStart.currentPhrase} | required=${sessionAfterStart.requiredToken} | reply=${validReply} | result=${JSON.stringify(playResult)}`
    );
  }

  const sessionAfterBotReply = getSessionStatus(channelId);
  const remainingPlayerReplies = countAvailableFollowups(sessionAfterBotReply.requiredToken, sessionAfterBotReply);
  if (remainingPlayerReplies < 3) {
    throw new Error(
      `PvE bot made the early round too hard | current=${sessionAfterBotReply.currentPhrase} | required=${sessionAfterBotReply.requiredToken} | replies=${remainingPlayerReplies}`
    );
  }

  stopSession(channelId);
  disableRoom(channelId);
  return { acceptedReply: validReply, remainingPlayerReplies };
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
  if (!playResult?.ok || !playResult.reply.includes("PVP")) {
    throw new Error("!play did not open PvP round");
  }

  const rankResult = await handleWordChainMessage(createMessage(channel, "guild-6", "!rank", "u11", "Kira"));
  if (!rankResult?.ok || !rankResult.reply.includes("Bảng xếp hạng")) {
    throw new Error("!rank did not return ranking");
  }

  const stopResult = await handleWordChainMessage(createMessage(channel, "guild-6", "!stop", "u11", "Kira"));
  if (!stopResult?.ok || !stopResult?.reply?.includes("Đã kết thúc")) {
    throw new Error("!stop did not end the current session");
  }

  disableRoom(channelId);
  return { unknownCommandHelp: true, playStartsGame: true, rankWorks: true, stopEndsRound: true };
}

async function runPvpCheckpointRewardFlow() {
  const channel = new FakeChannel("test-pvp-checkpoint-room", "pvp-checkpoint-room");
  const session = {
    mode: "pvp",
    moveCount: 25,
    lastRewardMoveCount: 0,
    scores: new Map([
      ["u20", 14],
      ["u21", 11]
    ]),
    rewardedScores: new Map(),
    usernames: new Map([
      ["u20", "Lead"],
      ["u21", "Rival"]
    ])
  };

  const checkpointReward = await maybeAwardPvpCheckpoint(channel, session);
  if (!checkpointReward?.rewarded) {
    throw new Error("Checkpoint reward did not trigger");
  }
  if ((session.lastRewardMoveCount || 0) !== 25) {
    throw new Error("Checkpoint reward did not update lastRewardMoveCount");
  }
  if ((session.rewardedScores?.size || 0) < 2) {
    throw new Error("Checkpoint rewarded scores were not snapshotted");
  }
  if (channel.sent.length === 0) {
    throw new Error("Checkpoint reward did not send announcement");
  }

  session.moveCount = 31;
  session.scores.set("u20", 17);
  session.scores.set("u21", 13);

  const finalReward = await distributeFinalRewards(session);
  if (!finalReward?.lines?.length) {
    throw new Error("Final reward did not return lines after checkpoint");
  }

  return { checkpointAwarded: true, finalRewardLines: finalReward.lines.length, announcements: channel.sent.length };
}

async function main() {
  const pvp = await runPvpFlow();
  const pve = await runPveFlow();
  const textCommands = await runTextCommandFlow();
  const pvpCheckpoint = await runPvpCheckpointRewardFlow();

  console.log(JSON.stringify({ ok: true, pvp, pve, textCommands, pvpCheckpoint }, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error("Word-chain mode test failed:", error);
  process.exit(1);
});
