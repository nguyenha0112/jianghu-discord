const fs = require("node:fs");
const path = require("node:path");
const { enableRoom, disableRoom } = require("../storage/word-chain-room-store");
const {
  normalizePhrase,
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

function findLoopPair() {
  const dictionaryPaths = [
    path.join(__dirname, "..", "..", "data", "vietnamese-compound-phrases.txt"),
    path.join(__dirname, "..", "..", "data", "custom-vietnamese-phrases.txt")
  ];

  const phrases = [
    ...new Set(
      dictionaryPaths
        .flatMap((filePath) => fs.readFileSync(filePath, "utf8").split(/\r?\n/u))
        .map((line) => normalizePhrase(line))
        .filter(Boolean)
        .filter((phrase) => phrase.split(" ").length === 2)
    )
  ];

  const byFirstToken = new Map();
  for (const phrase of phrases) {
    const [firstToken] = phrase.split(" ");
    const group = byFirstToken.get(firstToken) || [];
    group.push(phrase);
    byFirstToken.set(firstToken, group);
  }

  for (const phrase of phrases) {
    const [firstToken, lastToken] = phrase.split(" ");
    const candidates = byFirstToken.get(lastToken) || [];
    for (const candidate of candidates) {
      const [, candidateLastToken] = candidate.split(" ");
      if (candidate !== phrase && candidateLastToken === firstToken) {
        return {
          opening: phrase,
          reply: candidate
        };
      }
    }
  }

  throw new Error("Could not find a loop pair in the word-chain dictionary");
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
  const firstPhrase = sessionAfterStart.currentPhrase;
  const nextToken = sessionAfterStart.requiredToken;
  if (!firstPhrase || !nextToken) {
    throw new Error("PvP session missing start state");
  }

  const validReply = findPlayablePhraseForToken(nextToken, "guild-1", [firstPhrase]);
  if (!validReply) {
    throw new Error(`PvP could not find playable phrase for token: ${nextToken}`);
  }
  const playResult = await handleWordChainMessage(createMessage(channel, "guild-1", validReply, "u2", "Bob"));
  if (!playResult?.ok) {
    throw new Error(`PvP valid move rejected: ${validReply}`);
  }

  const sessionAfterMove = getSessionStatus(channelId);
  if (!sessionAfterMove || sessionAfterMove.moveCount < 1) {
    throw new Error("PvP move was not recorded");
  }

  stopSession(channelId);
  disableRoom(channelId);
  return {
    firstPhrase,
    acceptedReply: validReply,
    moveCount: sessionAfterMove.moveCount
  };
}

async function runPvpRecentRepeatFlow() {
  const channelId = "test-pvp-recent-room";
  disableRoom(channelId);
  stopSession(channelId);
  enableRoom(channelId, {
    guildId: "guild-4",
    channelName: "pvp-recent-room",
    mode: "pvp",
    createdByUserId: "admin",
    createdByUsername: "Admin"
  });

  const channel = new FakeChannel(channelId, "pvp-recent-room");
  const loopPair = findLoopPair();

  const startResult = await handleWordChainMessage(createMessage(channel, "guild-4", loopPair.opening, "u8", "Hana"));
  if (!startResult?.ok) {
    throw new Error("PvP recent-repeat start failed");
  }

  const firstReply = await handleWordChainMessage(createMessage(channel, "guild-4", loopPair.reply, "u9", "Ivan"));
  if (!firstReply?.ok) {
    throw new Error("PvP recent-repeat first reply failed");
  }

  const repeatedResult = await handleWordChainMessage(createMessage(channel, "guild-4", loopPair.opening, "u8", "Hana"));
  if (repeatedResult?.ok || !repeatedResult?.reply?.includes("Bạn có thể dùng lại sau")) {
    throw new Error("PvP recent-repeat warning did not return expected message");
  }

  stopSession(channelId);
  disableRoom(channelId);
  return {
    repeatedPhrase: loopPair.opening,
    warningShown: true
  };
}

async function runPvpRoundWinFlow() {
  const channelId = "test-pvp-win-room";
  disableRoom(channelId);
  stopSession(channelId);
  enableRoom(channelId, {
    guildId: "guild-3",
    channelName: "pvp-win-room",
    mode: "pvp",
    createdByUserId: "admin",
    createdByUsername: "Admin"
  });

  const channel = new FakeChannel(channelId, "pvp-win-room");

  const startPhrase = "á châu";
  const startResult = await handleWordChainMessage(createMessage(channel, "guild-3", startPhrase, "u4", "Dora"));
  if (!startResult?.ok) {
    throw new Error("PvP win-flow start failed");
  }

  const sessionAfterStart = getSessionStatus(channelId);
  if (sessionAfterStart.requiredToken !== "châu") {
    throw new Error(`PvP win-flow started with unexpected token: ${sessionAfterStart.requiredToken}`);
  }

  const winningReply = "châu chấu";
  const beforeCurrentPhrase = sessionAfterStart.currentPhrase;
  const playResult = await handleWordChainMessage(createMessage(channel, "guild-3", winningReply, "u5", "Erin"));
  if (!playResult?.ok) {
    throw new Error(`PvP winning move rejected: ${winningReply}`);
  }

  const sessionAfterMove = getSessionStatus(channelId);
  const restarted = sessionAfterMove.currentPhrase !== normalizeForTest(beforeCurrentPhrase) && sessionAfterMove.moveCount === 0;

  if (!restarted) {
    throw new Error("PvP auto-next-round did not restart after dead-end phrase");
  }

  stopSession(channelId);
  disableRoom(channelId);
  return {
    winningReply,
    restarted
  };
}

function normalizeForTest(input) {
  return (input || "").toLowerCase().normalize("NFC");
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

  const startResult = await handleWordChainMessage(createMessage(channel, "guild-2", "yêu thương", "u3", "Carol"));
  if (!startResult?.ok) {
    throw new Error("PvE start failed");
  }

  const sessionAfterStart = getSessionStatus(channelId);
  const nextToken = sessionAfterStart.requiredToken;
  const validReply = findPlayablePhraseForToken(nextToken, "guild-2", [sessionAfterStart.currentPhrase]);
  if (!validReply) {
    throw new Error(`PvE could not find playable phrase for token: ${nextToken}`);
  }
  const playResult = await handleWordChainMessage(createMessage(channel, "guild-2", validReply, "u3", "Carol"));
  if (!playResult?.ok) {
    throw new Error(`PvE valid move rejected: ${validReply}`);
  }
  if (playResult.react !== "success") {
    throw new Error("PvE accepted move should request a success reaction");
  }

  const sessionAfterBot = getSessionStatus(channelId);
  if (!sessionAfterBot || sessionAfterBot.moveCount < 2) {
    throw new Error("PvE bot did not answer back");
  }

  stopSession(channelId);
  disableRoom(channelId);
  return {
    acceptedReply: validReply,
    botCurrentPhrase: sessionAfterBot.currentPhrase,
    moveCount: sessionAfterBot.moveCount
  };
}

async function main() {
  const pvp = await runPvpFlow();
  const pvpRecentRepeat = await runPvpRecentRepeatFlow();
  const pvpRoundWin = await runPvpRoundWinFlow();
  const pve = await runPveFlow();

  console.log(
    JSON.stringify(
      {
        ok: true,
        pvp,
        pvpRecentRepeat,
        pvpRoundWin,
        pve
      },
      null,
      2
    )
  );

  process.exit(0);
}

main().catch((error) => {
  console.error("Word-chain mode test failed:", error);
  process.exit(1);
});
