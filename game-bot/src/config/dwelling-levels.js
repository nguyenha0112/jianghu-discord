module.exports = [
  {
    level: 1,
    name: "Thảo Am",
    emoji: "🏕️",
    xuBonusPercent: 0,
    professionXpBonusPercent: 0,
    upgradeCost: null
  },
  {
    level: 2,
    name: "Linh Cốc",
    emoji: "🏞️",
    xuBonusPercent: 6,
    professionXpBonusPercent: 6,
    upgradeCost: {
      xu: 600,
      items: [
        { itemId: "wild_herb", quantity: 4 },
        { itemId: "forest_fiber", quantity: 3 }
      ]
    }
  },
  {
    level: 3,
    name: "Thanh Trúc Viện",
    emoji: "🎋",
    xuBonusPercent: 12,
    professionXpBonusPercent: 10,
    upgradeCost: {
      xu: 1600,
      items: [
        { itemId: "spirit_stone", quantity: 3 },
        { itemId: "minor_elixir", quantity: 2 },
        { itemId: "silver_ore", quantity: 2 }
      ]
    }
  },
  {
    level: 4,
    name: "Huyền Thiên Động",
    emoji: "🏯",
    xuBonusPercent: 18,
    professionXpBonusPercent: 15,
    upgradeCost: {
      xu: 3600,
      items: [
        { itemId: "foundation_pill", quantity: 1 },
        { itemId: "sealed_relic", quantity: 1 },
        { itemId: "moon_flower", quantity: 3 }
      ]
    }
  }
];
