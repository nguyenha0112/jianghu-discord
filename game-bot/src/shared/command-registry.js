const { SlashCommandBuilder } = require("discord.js");

const commandBuilders = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Kiem tra bot co dang online khong."),
  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Xem profile Jianghu cua ban."),
  new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Nhan daily hang ngay."),
  new SlashCommandBuilder()
    .setName("choose-profession")
    .setDescription("Chon nghe nghiep chinh cua ban.")
    .addStringOption((option) =>
      option
        .setName("profession")
        .setDescription("Nghe ban muon theo")
        .setRequired(true)
        .addChoices(
          { name: "Fishing", value: "fishing" },
          { name: "Mining", value: "mining" },
          { name: "Gathering", value: "gathering" },
          { name: "Alchemy", value: "alchemy" },
          { name: "Archaeology", value: "archaeology" }
        )
    ),
  new SlashCommandBuilder()
    .setName("work")
    .setDescription("Thuc hien hanh dong nghe nghiep de nhan reward."),
  new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("Xem inventory hien tai cua ban."),
  new SlashCommandBuilder()
    .setName("wallet")
    .setDescription("Xem tong quan tien te va chi so kinh te cua ban."),
  new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Ban vat pham trong kho de doi Xu.")
    .addStringOption((option) =>
      option
        .setName("item_id")
        .setDescription("Item ID, vi du river_fish")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("quantity")
        .setDescription("So luong muon ban")
        .setRequired(true)
        .setMinValue(1)
    ),
  new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Xem hoac mua vat pham trong shop.")
    .addStringOption((option) =>
      option
        .setName("shop_id")
        .setDescription("Nhap shop_id neu muon mua ngay")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("craft")
    .setDescription("Xem hoac thuc hien craft theo cong thuc.")
    .addStringOption((option) =>
      option
        .setName("recipe_id")
        .setDescription("Nhap recipe_id neu muon craft ngay")
        .setRequired(false)
    )
];

const commandData = commandBuilders.map((builder) => builder.toJSON());

module.exports = {
  commandBuilders,
  commandData
};
