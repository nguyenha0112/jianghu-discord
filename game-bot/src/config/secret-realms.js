module.exports = [
  {
    realmId: "suong_moc_coc",
    name: "Sương Mộc Cốc",
    minRealmIndex: 0,
    cooldownHours: 8,
    xuRange: [120, 180],
    playerXpGain: 18,
    monster: {
      name: "Mộc Lang",
      emoji: "🐺",
      hpRange: [30, 45],
      attackText: "lao ra từ màn sương và vồ tới"
    },
    boss: {
      name: "Thanh Mộc Lang Vương",
      emoji: "🦊",
      hpRange: [80, 110],
      attackText: "gầm lên giữa rừng sâu, dẫn bầy linh thú vây đánh bạn",
      xuMultiplier: 2,
      xpMultiplier: 2,
      dropBonusWeight: 8
    },
    drops: [
      { itemId: "wild_herb", quantity: 2, weight: 35 },
      { itemId: "moon_flower", quantity: 1, weight: 20 },
      { itemId: "spirit_stone", quantity: 1, weight: 20 },
      { itemId: "herb_satchel", quantity: 1, weight: 5 },
      { itemId: "bamboo_rod", quantity: 1, weight: 5 },
      { itemId: "secret_manual_page", quantity: 1, weight: 15 }
    ]
  },
  {
    realmId: "hach_nham_dong",
    name: "Hắc Nham Động",
    minRealmIndex: 1,
    cooldownHours: 12,
    xuRange: [220, 320],
    playerXpGain: 28,
    monster: {
      name: "Nham Giáp Thú",
      emoji: "🦏",
      hpRange: [55, 75],
      attackText: "rung chuyển mặt đất rồi húc thẳng vào bạn"
    },
    boss: {
      name: "Hắc Nham Bá Chủ",
      emoji: "🦬",
      hpRange: [130, 170],
      attackText: "đập nát vách đá rồi lao tới như một ngọn núi sống",
      xuMultiplier: 2,
      xpMultiplier: 2,
      dropBonusWeight: 10
    },
    drops: [
      { itemId: "silver_ore", quantity: 2, weight: 25 },
      { itemId: "sealed_relic", quantity: 1, weight: 20 },
      { itemId: "spirit_stone", quantity: 2, weight: 20 },
      { itemId: "earth_hammer", quantity: 1, weight: 6 },
      { itemId: "flame_cauldron", quantity: 1, weight: 6 },
      { itemId: "secret_manual_page", quantity: 1, weight: 23 }
    ]
  },
  {
    realmId: "thien_tang_bao_dia",
    name: "Thiên Tàng Bảo Địa",
    minRealmIndex: 2,
    cooldownHours: 16,
    xuRange: [360, 520],
    playerXpGain: 40,
    monster: {
      name: "Thiên Tàng Hộ Linh",
      emoji: "👹",
      hpRange: [85, 110],
      attackText: "hét lớn, triệu hồi linh khí hộ thể và ép bạn giao chiến"
    },
    boss: {
      name: "Cổ Linh Thủ Tàng",
      emoji: "🐉",
      hpRange: [180, 230],
      attackText: "xé mây giáng thế, dùng uy áp cổ xưa ép bạn quyết chiến",
      xuMultiplier: 2,
      xpMultiplier: 2,
      dropBonusWeight: 12
    },
    drops: [
      { itemId: "foundation_pill", quantity: 1, weight: 18 },
      { itemId: "spirit_core", quantity: 1, weight: 10 },
      { itemId: "relic_compass", quantity: 1, weight: 8 },
      { itemId: "secret_manual_page", quantity: 2, weight: 34 },
      { itemId: "pearl_fragment", quantity: 2, weight: 30 }
    ]
  }
];
