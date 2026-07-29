module.exports = {
  fishing: {
    name: "Ngư Đạo",
    rewardText: "Bạn thả linh câu bên hàn đàm và thu được thủy bảo.",
    xpGain: 14,
    xuRange: [22, 34],
    drops: [
      { itemId: "river_fish", quantity: 1, weight: 58 },
      { itemId: "fresh_shrimp", quantity: 1, weight: 22 },
      { itemId: "pearl_fragment", quantity: 1, weight: 10 },
      { itemId: "spirit_stone", quantity: 1, weight: 10 }
    ]
  },
  mining: {
    name: "Khoáng Đạo",
    rewardText: "Bạn đào linh khoáng trong mạch núi và thu được vật liệu quý.",
    xpGain: 16,
    xuRange: [24, 36],
    drops: [
      { itemId: "iron_ore", quantity: 1, weight: 55 },
      { itemId: "crystal_shard", quantity: 1, weight: 20 },
      { itemId: "silver_ore", quantity: 1, weight: 15 },
      { itemId: "spirit_stone", quantity: 1, weight: 10 }
    ]
  },
  gathering: {
    name: "Thảo Đạo",
    rewardText: "Bạn trèo núi hái linh thảo, góp nhặt khí tức thiên địa.",
    xpGain: 13,
    xuRange: [20, 32],
    drops: [
      { itemId: "wild_herb", quantity: 1, weight: 45 },
      { itemId: "forest_fiber", quantity: 1, weight: 25 },
      { itemId: "moon_flower", quantity: 1, weight: 20 },
      { itemId: "spirit_stone", quantity: 1, weight: 10 }
    ]
  },
  alchemy: {
    name: "Đan Đạo",
    rewardText: "Bạn luyện đan trong động phủ, ngưng tụ dược lực thành linh vật.",
    xpGain: 17,
    xuRange: [23, 35],
    drops: [
      { itemId: "catalyst_powder", quantity: 1, weight: 45 },
      { itemId: "minor_elixir", quantity: 1, weight: 30 },
      { itemId: "refined_essence", quantity: 1, weight: 15 },
      { itemId: "foundation_pill", quantity: 1, weight: 10 }
    ]
  },
  archaeology: {
    name: "Cổ Tu Đạo",
    rewardText: "Bạn khai quật bí cảnh cổ, nhặt được dị bảo bị chôn vùi từ lâu.",
    xpGain: 18,
    xuRange: [26, 38],
    drops: [
      { itemId: "old_coin", quantity: 1, weight: 45 },
      { itemId: "relic_fragment", quantity: 1, weight: 25 },
      { itemId: "sealed_relic", quantity: 1, weight: 20 },
      { itemId: "spirit_core", quantity: 1, weight: 10 }
    ]
  }
};
