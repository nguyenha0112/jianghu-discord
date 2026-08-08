const { enableRoom, disableRoom } = require("../storage/xidach-room-store");
const { ensurePlayer, getPlayer, updatePlayer } = require("../storage/player-store");
const {
  getSessionStatus,
  handleMessage,
  handleButtonInteraction,
  stopSession
} = require("../services/xidach-service");

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

function createMessage(channel, guildId, content, userId, username, member = {}) {
  return {
    content,
    channel,
    guild: { id: guildId },
    author: { id: userId, username, bot: false },
    member
  };
}

function createButtonInteraction(channel, guildId, customId, userId, username) {
  return {
    customId,
    channel,
    channelId: channel.id,
    guildId,
    user: { id: userId, username },
    replies: [],
    deferred: false,
    replied: false,
    async deferReply() {
      this.deferred = true;
    },
    async deferUpdate() {
      this.deferred = true;
    },
    async editReply(content) {
      this.replies.push(content);
      this.replied = true;
    },
    async reply(payload) {
      this.replies.push(payload);
      this.replied = true;
    },
    async showModal(modal) {
      this.modal = modal;
      this.replied = true;
    }
  };
}

async function seedPlayer(userId, username, xu) {
  await ensurePlayer(userId, username);
  const current = await getPlayer(userId);
  await updatePlayer(userId, {
    username,
    wallet: {
      ...current.wallet,
      xu
    }
  });
}

async function main() {
  const guildId = "test-guild-xidach";
  const channel = new FakeChannel("test-xidach-channel", "xi-dach-test");
  const hostId = "xidach-host";
  const otherId = "xidach-other";

  disableRoom(channel.id);
  stopSession(channel.id);
  enableRoom(channel.id, { guildId, channelName: channel.name });
  await seedPlayer(hostId, "Host", 5000);
  await seedPlayer(otherId, "Other", 5000);

  const lobby = await handleMessage(createMessage(channel, guildId, "!play", hostId, "Host"));
  if (!lobby?.files?.[0] || lobby.files[0].attachment.length < 100) {
    throw new Error("Lobby did not include compact Xu SVG attachment");
  }

  const start = await handleMessage(createMessage(channel, guildId, "!play 1.000", hostId, "Host"));
  if (!start?.ok || !getSessionStatus(channel.id)) {
    throw new Error("Formatted bet command did not start Xi Dach round");
  }
  const boardAttachment = channel.sent.at(-1)?.payload?.files?.[0];
  if (!boardAttachment || boardAttachment.name !== "xidach-board.svg") {
    throw new Error("Xi Dach board attachment was not generated as SVG");
  }

  const otherPlay = await handleMessage(createMessage(channel, guildId, "!play", otherId, "Other"));
  if (!otherPlay?.reply?.includes(hostId)) {
    throw new Error("Other player did not receive active-session owner guidance");
  }

  const otherHit = createButtonInteraction(channel, guildId, `xidach:action:${channel.id}:hit`, otherId, "Other");
  await handleButtonInteraction(otherHit);
  if (!JSON.stringify(otherHit.replies).includes("không phải chủ ván")) {
    throw new Error("Other player button press did not explain host-only control");
  }

  const session = getSessionStatus(channel.id);
  session.updatedAt = Date.now() - 6 * 60 * 1000;
  const staleStop = await handleMessage(createMessage(channel, guildId, "!stop", otherId, "Other"));
  if (!staleStop?.ok || getSessionStatus(channel.id)) {
    throw new Error("Stale Xi Dach round was not stoppable by another player");
  }

  console.log(JSON.stringify({ ok: true, lobbyIcon: true, formattedBet: true, svgBoard: true, staleStop: true }, null, 2));
}

main().catch((error) => {
  console.error("Xi Dach flow test failed:", error);
  process.exit(1);
});
