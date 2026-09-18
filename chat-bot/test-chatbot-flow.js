const { sanitizeTextForTTS, splitTextForTTS, shouldReplyUnknownTextCommand } = require("./index");

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
  assert(
    sanitizeTextForTTS("xem ảnh nè https://cdn.discordapp.com/attachments/123/456/photo.png") === "xem ảnh nè",
    "Link ảnh Discord chưa được loại khỏi nội dung đọc."
  );
  assert(
    sanitizeTextForTTS("xin chào <:cute:123456789012345678> <a:dance:987654321098765432> 😄") === "xin chào",
    "Emoji hoặc mã emoji Discord chưa được loại khỏi nội dung đọc."
  );
  assert(sanitizeTextForTTS("xin chào :cute: :dance:") === "xin chào", "Tên emoji từ cleanContent chưa được loại bỏ.");
  assert(sanitizeTextForTTS("1️⃣ 🇻🇳 nội dung") === "nội dung", "Emoji số hoặc cờ chưa được loại bỏ.");
  assert(sanitizeTextForTTS("<:cute:123456789012345678> 🖼️") === "", "Tin chỉ có emoji phải được bỏ qua.");
  assert(sanitizeTextForTTS("ảnh https://example.com/a.jpg và chữ còn lại") === "ảnh và chữ còn lại", "Phần chữ sau URL bị mất.");

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
