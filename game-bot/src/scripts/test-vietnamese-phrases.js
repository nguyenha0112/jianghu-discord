const { isMeaningfulPhrase, normalizePhrase } = require("../services/word-chain-service");

const samples = [
  "tạch môn",
  "tập hát",
  "tập bò",
  "tập tành",
  "xưởng mộc",
  "xưởng gỗ",
  "gỗ lim",
  "mặt trời",
  "trời xanh",
  "quê nhà",
  "niềm vui",
  "cửa công"
];

const results = samples.map((phrase) => ({
  phrase,
  normalized: normalizePhrase(phrase),
  meaningful: isMeaningfulPhrase(phrase)
}));

console.log(JSON.stringify({ ok: true, results }, null, 2));
