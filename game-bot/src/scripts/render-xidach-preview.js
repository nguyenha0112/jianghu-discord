const fs = require("node:fs");
const path = require("node:path");
const { buildVisualAttachments } = require("../services/xidach-service");

async function main() {
  const outputPath = path.resolve(process.argv[2] || path.join("data", "runtime", "xidach-preview.png"));
  const session = {
    hostUsername: "Lục Hà",
    betAmount: 1000,
    playerCards: [
      { rank: "A", suitCode: "H" }, { rank: "5", suitCode: "S" }, { rank: "3", suitCode: "D" },
      { rank: "2", suitCode: "C" }, { rank: "9", suitCode: "H" }
    ],
    dealerCards: [{ rank: "K", suitCode: "S" }, { rank: "7", suitCode: "D" }]
  };
  const [attachment] = await buildVisualAttachments(session, {
    revealDealer: true,
    note: "Bạn thắng Ngũ Linh và nhận 2.000 Xu. Số dư hiện tại: 12.500 Xu."
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, attachment.attachment);
  console.log(outputPath);
}

main().catch((error) => { console.error(error); process.exit(1); });
