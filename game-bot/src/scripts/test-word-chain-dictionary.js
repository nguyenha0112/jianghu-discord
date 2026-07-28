const { lookupVietnameseDictionary } = require("../lib/vietnamese-dictionary");

async function main() {
  const samples = ["học sinh", "quê nhà", "tạch môn", "abc xyz"];
  const results = [];

  for (const phrase of samples) {
    const result = await lookupVietnameseDictionary(phrase);
    results.push({
      phrase,
      exists: result.exists,
      accepted: result.accepted,
      source: result.source,
      firstMeaning: result.meanings?.[0]?.definition || null
    });
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
  console.error("Word-chain dictionary test failed:", error);
  process.exit(1);
});
