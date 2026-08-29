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
  const channelId = "test-vttv-room";
  disableRoom(channelId);
  stopSession(channelId);

  enableRoom(channelId, {
    guildId: "guild-king",
    channelName: "vua-tieng-viet",
    createdByUserId: "admin",
    createdByUsername: "Admin"
  });

  const channel = new FakeChannel(channelId, "vua-tieng-viet");

  const startResult = await handleMessage(createMessage(channel, "guild-king", "!play", "u1", "Alice"));
  if (!startResult?.ok) {
    throw new Error("Không mở được ván Vua Tiếng Việt");
  }

  const session = getSessionStatus(channelId);
  if (!session?.currentPuzzle?.answer || !session?.scrambledText) {
    throw new Error("Không tạo được câu đố đầu tiên");
  }

  const hintResult = await handleMessage(createMessage(channel, "guild-king", "!goiy", "u1", "Alice"));
  if (!hintResult?.ok || !hintResult.reply.includes("Gợi ý") || !hintResult.reply.includes("bị trừ")) {
    throw new Error("!goiy không hoạt động");
  }

  const answer = session.currentPuzzle.answer;
  const guessResult = await handleMessage(createMessage(channel, "guild-king", answer, "u2", "Bob"));
  if (!guessResult?.ok || guessResult.react !== "success") {
    throw new Error("Đoán đúng nhưng bot không chấp nhận");
  }

  const rankResult = await handleMessage(createMessage(channel, "guild-king", "!rank", "u1", "Alice"));
  if (!rankResult?.ok || !rankResult.reply.includes("Bảng xếp hạng")) {
    throw new Error("!rank không trả về bảng xếp hạng");
  }

  const stopResult = await handleMessage(createMessage(channel, "guild-king", "!stop", "u1", "Alice"));
  if (!stopResult?.ok || !stopResult.reply.includes("Đã kết thúc")) {
    throw new Error("!stop không kết thúc ván");
  }
  if (!stopResult.reply.includes("Một vài đáp án") || !stopResult.reply.includes(answer)) {
    throw new Error("!stop không hiển thị đáp án mẫu");
  }

  disableRoom(channelId);
  console.log(
    JSON.stringify(
      {
        ok: true,
        firstPuzzle: answer,
        scrambled: session.scrambledText,
        hintWorks: true,
        guessWorks: true,
        rankWorks: true,
        stopWorks: true
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Vietnamese king test failed:", error);
  process.exit(1);
});
