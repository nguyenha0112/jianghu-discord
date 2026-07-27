module.exports = [
  {
    recipeId: "craft_bait",
    name: "Craft Basic Bait",
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
    description: "Che tao mo cau co ban tu thao moc va ca tuoi."
  },
  {
    recipeId: "craft_minor_potion",
    name: "Craft Minor Potion",
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
    description: "Che tao binh thuoc co ban cho progression sau nay."
  },
  {
    recipeId: "craft_polished_relic",
    name: "Craft Polished Relic",
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
    description: "Tinh luyen co vat de tang gia tri suu tam."
  }
];
