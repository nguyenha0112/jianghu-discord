const { disableRoom, enableRoom } = require("../storage/taixiu-room-store");
const { getSessionStatus, handleMessage, stopSession } = require("../services/taixiu-service");
const { ensurePlayer, getPlayer, updatePlayer } = require("../storage/player-store");

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
  const channelId = "test-taixiu-room";
  disableRoom(channelId);
  stopSession(channelId);

  await seedPlayer("u1", "Alice", 1000);
  await seedPlayer("u2", "Bob", 1000);
  await seedPlayer("u3", "Carol", 1000);

  enableRoom(channelId, {
    guildId: "guild-taixiu",
    channelName: "tai-xiu",
    createdByUserId: "admin",
    createdByUsername: "Admin"
  });

  const channel = new FakeChannel(channelId, "tai-xiu");

  const startResult = await handleMessage(createMessage(channel, "guild-taixiu", "!play", "u1", "Alice"));
  if (!startResult?.ok) {
    throw new Error("Không mở được kèo Tài Xỉu");
  }

  const betTai = await handleMessage(createMessage(channel, "guild-taixiu", "!tai 100", "u2", "Bob"));
  if (!betTai?.ok) {
    throw new Error("Bob không đặt được cược Tài");
  }

  const betXiu = await handleMessage(createMessage(channel, "guild-taixiu", "!xiu 150", "u3", "Carol"));
  if (!betXiu?.ok) {
    throw new Error("Carol không đặt được cược Xỉu");
  }

  const session = getSessionStatus(channelId);
  if (!session || session.bets.size !== 2) {
    throw new Error("Không lưu đủ số cược");
  }

  const closeResult = await handleMessage(createMessage(channel, "guild-taixiu", "!chot", "u1", "Alice"));
  if (!closeResult?.ok || !closeResult.reply.includes("Kết quả xúc xắc")) {
    throw new Error("Không chốt được kèo");
  }

  const afterSession = getSessionStatus(channelId);
  if (afterSession) {
    throw new Error("Kèo chưa được đóng sau khi chốt");
  }

  const bob = await getPlayer("u2");
  const carol = await getPlayer("u3");

  disableRoom(channelId);

  console.log(
    JSON.stringify(
      {
        ok: true,
        opened: true,
        twoBetsAccepted: true,
        closed: true,
        bobXu: bob.wallet.xu,
        carolXu: carol.wallet.xu
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Tai xiu test failed:", error);
  process.exit(1);
});
