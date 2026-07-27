module.exports = {
  fishing: {
    name: "Fishing",
    rewardText: "Ban tha cau va bat duoc me ca dau mua.",
    xpGain: 12,
    xuRange: [18, 30],
    drops: [
      { itemId: "river_fish", quantity: 1, weight: 70 },
      { itemId: "fresh_shrimp", quantity: 1, weight: 20 },
      { itemId: "pearl_fragment", quantity: 1, weight: 10 }
    ]
  },
  mining: {
    name: "Mining",
    rewardText: "Ban dao quang trong mo va lay duoc tai nguyen tho.",
    xpGain: 14,
    xuRange: [20, 34],
    drops: [
      { itemId: "iron_ore", quantity: 1, weight: 70 },
      { itemId: "crystal_shard", quantity: 1, weight: 20 },
      { itemId: "silver_ore", quantity: 1, weight: 10 }
    ]
  },
  gathering: {
    name: "Gathering",
    rewardText: "Ban len nui thu thap thao moc va vat lieu tu nhien.",
    xpGain: 11,
    xuRange: [16, 28],
    drops: [
      { itemId: "wild_herb", quantity: 1, weight: 50 },
      { itemId: "forest_fiber", quantity: 1, weight: 30 },
      { itemId: "moon_flower", quantity: 1, weight: 20 }
    ]
  },
  alchemy: {
    name: "Alchemy",
    rewardText: "Ban nghien cuu dan duoc va tao ra vat lieu hoa giai.",
    xpGain: 13,
    xuRange: [19, 31],
    drops: [
      { itemId: "catalyst_powder", quantity: 1, weight: 55 },
      { itemId: "minor_elixir", quantity: 1, weight: 30 },
      { itemId: "refined_essence", quantity: 1, weight: 15 }
    ]
  },
  archaeology: {
    name: "Archaeology",
    rewardText: "Ban khai quat phu tich va nhat duoc mot vat co xua.",
    xpGain: 16,
    xuRange: [22, 36],
    drops: [
      { itemId: "old_coin", quantity: 1, weight: 55 },
      { itemId: "relic_fragment", quantity: 1, weight: 30 },
      { itemId: "sealed_relic", quantity: 1, weight: 15 }
    ]
  }
};
