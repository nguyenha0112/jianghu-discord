const { SlashCommandBuilder } = require("discord.js");

const commandBuilders = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Kiem tra bot co dang online khong."),
  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Xem ho so Jianghu cua ban."),
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
    .setDescription("Thuc hien hanh dong nghe nghiep de nhan thuong."),
  new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("Xem tui do hien tai cua ban."),
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
    ),
  new SlashCommandBuilder()
    .setName("admin-player")
    .setDescription("Xem thong tin chi tiet cua mot player.")
    .addStringOption((option) =>
      option
        .setName("user_id")
        .setDescription("Discord user ID cua player")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("admin-transactions")
    .setDescription("Xem giao dich gan nhat.")
    .addStringOption((option) =>
      option
        .setName("user_id")
        .setDescription("Loc theo Discord user ID")
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription("So giao dich muon xem")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(20)
    ),
  new SlashCommandBuilder()
    .setName("admin-reset-player")
    .setDescription("Reset toan bo du lieu cua mot player.")
    .addStringOption((option) =>
      option
        .setName("user_id")
        .setDescription("Discord user ID cua player")
        .setRequired(true)
    )
];

const commandData = commandBuilders.map((builder) => builder.toJSON());

module.exports = {
  commandBuilders,
  commandData
};
