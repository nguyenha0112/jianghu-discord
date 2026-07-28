function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

function formatXu(value) {
  return `🪙 ${formatNumber(value)} Xu`;
}

function getBetKindLabel(kind, target = null) {
  if (kind === "tai") {
    return "Tài (11-18)";
  }
  if (kind === "xiu") {
    return "Xỉu (3-10)";
  }
  if (kind === "chan") {
    return "Chẵn";
  }
  if (kind === "le") {
    return "Lẻ";
  }
  if (kind === "so") {
    return `Số ${target}`;
  }
  return kind;
}

function buildBetButtonConfig(kind) {
  const map = {
    tai: { label: "🔥 Tài" },
    xiu: { label: "🌊 Xỉu" },
    chan: { label: "⚖️ Chẵn" },
    le: { label: "🎯 Lẻ" },
    so: { label: "🎲 Số" }
  };
  return map[kind] || { label: kind };
}

module.exports = {
  buildBetButtonConfig,
  formatXu,
  getBetKindLabel
};
