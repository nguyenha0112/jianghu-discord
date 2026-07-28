module.exports = [
  {
    recipeId: "craft_bait",
    name: "Luyện Mồi Linh Câu",
    output: {
      itemId: "basic_bait",
      quantity: 1
    },
    cost: {
      xu: 8
    },
    inputs: [
      { itemId: "wild_herb", quantity: 1 },
      { itemId: "river_fish", quantity: 1 }
    ],
    description: "Luyện chế mồi linh câu cơ bản từ linh thảo và linh ngư."
  },
  {
    recipeId: "craft_minor_potion",
    name: "Luyện Tiểu Linh Đan",
    output: {
      itemId: "minor_potion",
      quantity: 1
    },
    cost: {
      xu: 15
    },
    inputs: [
      { itemId: "wild_herb", quantity: 2 },
      { itemId: "catalyst_powder", quantity: 1 }
    ],
    description: "Luyện chế đan dược cơ bản để ổn định linh lực."
  },
  {
    recipeId: "craft_polished_relic",
    name: "Tinh Luyện Cổ Bảo",
    output: {
      itemId: "polished_relic",
      quantity: 1
    },
    cost: {
      xu: 25
    },
    inputs: [
      { itemId: "relic_fragment", quantity: 2 },
      { itemId: "crystal_shard", quantity: 1 }
    ],
    description: "Tinh luyện cổ vật để tăng giá trị và phục vụ đột phá."
  },
  {
    recipeId: "craft_foundation_pill",
    name: "Luyện Trúc Cơ Đan",
    output: {
      itemId: "foundation_pill",
      quantity: 1
    },
    cost: {
      xu: 120
    },
    inputs: [
      { itemId: "minor_elixir", quantity: 2 },
      { itemId: "moon_flower", quantity: 1 },
      { itemId: "spirit_stone", quantity: 2 }
    ],
    description: "Đan dược quan trọng dùng để trùng kích Trúc Cơ."
  },
  {
    recipeId: "craft_spirit_core",
    name: "Ngưng Tụ Kim Đan Phôi",
    output: {
      itemId: "spirit_core",
      quantity: 1
    },
    cost: {
      xu: 260
    },
    inputs: [
      { itemId: "refined_essence", quantity: 2 },
      { itemId: "sealed_relic", quantity: 1 },
      { itemId: "spirit_stone", quantity: 4 }
    ],
    description: "Ngưng tụ linh lực và dị bảo để chuẩn bị bước vào Kim Đan."
  },
  {
    recipeId: "craft_bamboo_rod",
    name: "Luyện Thanh Trúc Câu",
    output: {
      itemId: "bamboo_rod",
      quantity: 1
    },
    cost: {
      xu: 180
    },
    inputs: [
      { itemId: "river_fish", quantity: 2 },
      { itemId: "forest_fiber", quantity: 2 },
      { itemId: "spirit_stone", quantity: 1 }
    ],
    description: "Pháp bảo hỗ trợ Ngư Đạo, giúp tụ linh nơi sông nước."
  },
  {
    recipeId: "craft_earth_hammer",
    name: "Luyện Địa Chấn Chùy",
    output: {
      itemId: "earth_hammer",
      quantity: 1
    },
    cost: {
      xu: 180
    },
    inputs: [
      { itemId: "iron_ore", quantity: 2 },
      { itemId: "silver_ore", quantity: 1 },
      { itemId: "spirit_stone", quantity: 1 }
    ],
    description: "Pháp bảo hỗ trợ Khoáng Đạo, tăng hiệu quả khai mạch."
  },
  {
    recipeId: "craft_herb_satchel",
    name: "Luyện Túi Bách Thảo",
    output: {
      itemId: "herb_satchel",
      quantity: 1
    },
    cost: {
      xu: 180
    },
    inputs: [
      { itemId: "wild_herb", quantity: 2 },
      { itemId: "moon_flower", quantity: 1 },
      { itemId: "forest_fiber", quantity: 2 }
    ],
    description: "Pháp bảo hỗ trợ Thảo Đạo, thuận lợi thu hái linh thảo."
  },
  {
    recipeId: "craft_flame_cauldron",
    name: "Luyện Ly Hỏa Đỉnh",
    output: {
      itemId: "flame_cauldron",
      quantity: 1
    },
    cost: {
      xu: 220
    },
    inputs: [
      { itemId: "minor_elixir", quantity: 2 },
      { itemId: "catalyst_powder", quantity: 2 },
      { itemId: "spirit_stone", quantity: 1 }
    ],
    description: "Pháp bảo hỗ trợ Đan Đạo, tăng hiệu suất luyện đan."
  },
  {
    recipeId: "craft_relic_compass",
    name: "Luyện Tầm Bảo La Bàn",
    output: {
      itemId: "relic_compass",
      quantity: 1
    },
    cost: {
      xu: 220
    },
    inputs: [
      { itemId: "relic_fragment", quantity: 2 },
      { itemId: "crystal_shard", quantity: 1 },
      { itemId: "spirit_stone", quantity: 1 }
    ],
    description: "Pháp bảo hỗ trợ Cổ Tu Đạo, tăng cơ duyên tìm dị bảo."
  }
];
