const { splitTextForTTS, shouldReplyUnknownTextCommand } = require("./index");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const longMessage = [
    "Đây là một tin nhắn rất dài để kiểm tra chatbot không được cắt cụt nội dung của người dùng.",
    "Bot cần chia nội dung thành nhiều đoạn ngắn, đọc lần lượt, và vẫn giữ câu tiếng Việt dễ nghe.",
    "Nếu phần này bị gom thành một đoạn quá dài thì Google TTS hoặc voice pipeline rất dễ lỗi."
  ].join(" ");
  const chunks = splitTextForTTS(longMessage);

  assert(chunks.length > 1, "Tin nhắn dài chưa được chia đoạn.");
  assert(chunks.every((chunk) => chunk.length <= 170), "Có đoạn TTS vượt quá giới hạn mặc định.");
  assert(!shouldReplyUnknownTextCommand("play"), "Chatbot không được bắt nhầm !play của game bot.");
  assert(!shouldReplyUnknownTextCommand("stop"), "Chatbot không được bắt nhầm !stop của game bot.");
  assert(shouldReplyUnknownTextCommand("chatbot-sai"), "Chatbot vẫn cần báo help cho lệnh riêng bị sai.");

  console.log(
    JSON.stringify(
      {
        ok: true,
        chunks: chunks.length,
        ignoresGameCommands: true,
        repliesOwnInvalidCommand: true
      },
      null,
      2
    )
  );
}

main();
