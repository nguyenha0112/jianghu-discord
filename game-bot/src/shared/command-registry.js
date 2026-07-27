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
    .setDescription("Xem hoặc thực hiện craft theo công thức.")
    .addStringOption((option) =>
      option
        .setName("recipe_id")
        .setDescription("Nhập recipe_id nếu muốn craft ngay")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("noitu-tao-phong")
    .setDescription("Bật kênh hiện tại thành phòng chơi nối từ.")
    .addStringOption((option) =>
      option
        .setName("che_do")
        .setDescription("Chọn chế độ chơi cho phòng này")
        .setRequired(true)
        .addChoices(
          { name: "PvP", value: "pvp" },
          { name: "PvE", value: "pve" }
        )
    ),
  new SlashCommandBuilder()
    .setName("noitu-xoa-phong")
    .setDescription("Tắt chế độ phòng chơi nối từ ở kênh hiện tại."),
  new SlashCommandBuilder()
    .setName("noitu-tao")
    .setDescription("Tạo ván nối từ theo chế độ của phòng hiện tại.")
    .addStringOption((option) =>
      option
        .setName("tu_goi_y")
        .setDescription("Cụm mở đầu nếu bạn muốn tự chọn")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("noitu-trangthai")
    .setDescription("Xem trạng thái ván nối từ hiện tại."),
  new SlashCommandBuilder()
    .setName("noitu-dung")
    .setDescription("Dừng ván nối từ hiện tại."),
  new SlashCommandBuilder()
    .setName("admin-player")
    .setDescription("Xem thông tin chi tiết của một player.")
    .addStringOption((option) =>
      option
        .setName("user_id")
        .setDescription("Discord user ID của player")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("admin-transactions")
    .setDescription("Xem giao dịch gần nhất.")
    .addStringOption((option) =>
      option
        .setName("user_id")
        .setDescription("Lọc theo Discord user ID")
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription("Số giao dịch muốn xem")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(20)
    ),
  new SlashCommandBuilder()
    .setName("admin-reset-player")
    .setDescription("Reset toàn bộ dữ liệu của một player.")
    .addStringOption((option) =>
      option
        .setName("user_id")
        .setDescription("Discord user ID của player")
        .setRequired(true)
    )
];

const commandData = commandBuilders.map((builder) => builder.toJSON());

module.exports = {
  commandBuilders,
  commandData
};
