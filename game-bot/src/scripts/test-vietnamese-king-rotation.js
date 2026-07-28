const { disableRoom, enableRoom } = require("../storage/vietnamese-king-room-store");
const { getSessionStatus, handleMessage, stopSession } = require("../services/vietnamese-king-service");

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

async function main() {
  const channelId = "test-vttv-rotation";
  const guildId = "guild-vttv-rotation";
  disableRoom(channelId);
  stopSession(channelId);

  enableRoom(channelId, {
    guildId,
    channelName: "vttv-rotation",
    createdByUserId: "admin",
    createdByUsername: "Admin"
  });

  const channel = new FakeChannel(channelId, "vttv-rotation");
  const seen = [];

  for (let index = 0; index < 20; index += 1) {
    const startResult = await handleMessage(createMessage(channel, guildId, "!play", "u1", "Alice"));
    if (!startResult?.ok) {
      throw new Error("Khong mo duoc van Vua Tieng Viet.");
    }

    const session = getSessionStatus(channelId);
    if (!session?.currentPuzzle?.answer) {
      throw new Error("Khong lay duoc cau do hien tai.");
    }

    seen.push({
      answer: session.currentPuzzle.answer,
      difficulty: session.currentPuzzle.difficulty,
      type: session.currentPuzzle.type
    });

    const answerResult = await handleMessage(
      createMessage(channel, guildId, session.currentPuzzle.answer, "u2", "Bob")
    );
    if (!answerResult?.ok) {
      throw new Error(`Khong the giai cau ${session.currentPuzzle.answer}`);
    }
  }

  stopSession(channelId);
  disableRoom(channelId);

  const uniqueAnswers = new Set(seen.map((item) => item.answer));
  const difficultyBreakdown = seen.reduce((accumulator, item) => {
    accumulator[item.difficulty] = (accumulator[item.difficulty] || 0) + 1;
    return accumulator;
  }, {});

  console.log(
    JSON.stringify(
      {
        ok: true,
        total: seen.length,
        unique: uniqueAnswers.size,
        duplicates: seen.length - uniqueAnswers.size,
        difficultyBreakdown,
        sample: seen.slice(0, 12)
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Vietnamese king rotation test failed:", error);
  process.exit(1);
});
