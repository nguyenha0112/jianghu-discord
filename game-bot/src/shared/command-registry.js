const { SlashCommandBuilder } = require("discord.js");

const commandBuilders = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Kiểm tra bot có đang online không."),
  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Xem hồ sơ Jianghu của bạn."),
  new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Nhận daily hằng ngày."),
  new SlashCommandBuilder()
    .setName("choose-profession")
    .setDescription("Chọn nghề nghiệp chính của bạn.")
    .addStringOption((option) =>
      option
        .setName("profession")
        .setDescription("Nghề bạn muốn theo")
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
    .setDescription("Thực hiện hành động nghề nghiệp để nhận thưởng."),
  new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("Xem túi đồ hiện tại của bạn."),
  new SlashCommandBuilder()
    .setName("wallet")
    .setDescription("Xem tổng quan tiền tệ và chỉ số kinh tế của bạn."),
  new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Bán vật phẩm trong kho để đổi Xu.")
    .addStringOption((option) =>
      option
        .setName("item_id")
        .setDescription("Item ID, ví dụ river_fish")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("quantity")
        .setDescription("Số lượng muốn bán")
        .setRequired(true)
        .setMinValue(1)
    ),
  new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Xem hoặc mua vật phẩm trong shop.")
    .addStringOption((option) =>
      option
        .setName("shop_id")
        .setDescription("Nhập shop_id nếu muốn mua ngay")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("craft")
    .setDescription("Xem hoặc thực hiện chế tạo theo công thức.")
    .addStringOption((option) =>
      option
        .setName("recipe_id")
        .setDescription("Nhập recipe_id nếu muốn chế tạo ngay")
        .setRequired(false)
    )
];

const commandData = commandBuilders.map((builder) => builder.toJSON());

module.exports = {
  commandBuilders,
  commandData
};
