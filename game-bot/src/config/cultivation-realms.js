module.exports = [
  {
    key: "pham_nhan",
    name: "Phàm Nhân",
    levelCap: 10,
    breakthroughCost: {
      xu: 0,
      items: []
    }
  },
  {
    key: "luyen_khi",
    name: "Luyện Khí",
    levelCap: 20,
    breakthroughCost: {
      xu: 800,
      items: [
        { itemId: "minor_elixir", quantity: 2 },
        { itemId: "spirit_stone", quantity: 3 }
      ]
    }
  },
  {
    key: "truc_co",
    name: "Trúc Cơ",
    levelCap: 30,
    breakthroughCost: {
      xu: 2200,
      items: [
        { itemId: "foundation_pill", quantity: 1 },
        { itemId: "refined_essence", quantity: 2 },
        { itemId: "sealed_relic", quantity: 1 }
      ]
    }
  },
  {
    key: "kim_dan",
    name: "Kim Đan",
    levelCap: 45,
    breakthroughCost: {
      xu: 5000,
      items: [
        { itemId: "spirit_core", quantity: 1 },
        { itemId: "moon_flower", quantity: 3 },
        { itemId: "pearl_fragment", quantity: 3 }
      ]
    }
  }
];
