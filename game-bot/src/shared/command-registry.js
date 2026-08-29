const { SlashCommandBuilder } = require("discord.js");
const adminCommand = require("../commands/admin");

const commandBuilders = [
  adminCommand.data,
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
          { name: "Câu cá", value: "fishing" },
          { name: "Đào khoáng", value: "mining" },
          { name: "Hái lượm", value: "gathering" },
          { name: "Luyện dược", value: "alchemy" },
          { name: "Khảo cổ", value: "archaeology" }
        )
    ),
  new SlashCommandBuilder()
    .setName("work")
    .setDescription("Thực hiện hành động nghề nghiệp để nhận thưởng."),
  new SlashCommandBuilder()
    .setName("dotpha")
    .setDescription("Đột phá cảnh giới khi đã đủ điều kiện."),
  new SlashCommandBuilder()
    .setName("tutien")
    .setDescription("Xem tổng quan tu tiên, đạo tu và tiến độ đột phá."),
  new SlashCommandBuilder()
    .setName("dongphu")
    .setDescription("Xem hoặc nâng cấp động phủ của bạn.")
    .addStringOption((option) =>
      option
        .setName("hanh_dong")
        .setDescription("Chọn thao tác muốn thực hiện")
        .setRequired(false)
        .addChoices(
          { name: "Xem động phủ", value: "xem" },
          { name: "Nâng cấp động phủ", value: "nangcap" }
        )
    ),
  new SlashCommandBuilder()
    .setName("phapbao")
    .setDescription("Xem và trang bị pháp bảo.")
    .addStringOption((option) =>
      option
        .setName("hanh_dong")
        .setDescription("Thao tác muốn thực hiện")
        .setRequired(false)
        .addChoices(
          { name: "Xem pháp bảo", value: "xem" },
          { name: "Trang bị pháp bảo", value: "trangbi" },
          { name: "Tháo pháp bảo", value: "thao" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("artifact_id")
        .setDescription("ID pháp bảo muốn trang bị")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("bicanh")
    .setDescription("Thám hiểm bí cảnh, đánh quái hoặc khiêu chiến boss.")
    .addStringOption((option) =>
      option
        .setName("realm_id")
        .setDescription("ID bí cảnh muốn thám hiểm")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("che_do")
        .setDescription("Chọn đánh quái thường hoặc boss")
        .setRequired(false)
        .addChoices(
          { name: "Quái thường", value: "thuong" },
          { name: "Boss", value: "boss" }
        )
    ),
  new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("Xem túi đồ hiện tại của bạn."),
  new SlashCommandBuilder()
    .setName("wallet")
    .setDescription("Xem tổng quan tiền tệ và chỉ số kinh tế của bạn."),
  new SlashCommandBuilder()
    .setName("give-xu")
    .setDescription("Chuyển Xu cho một người chơi khác.")
    .addUserOption((option) =>
      option
        .setName("nguoi_nhan")
        .setDescription("Người nhận Xu")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("so_xu")
        .setDescription("Số Xu muốn chuyển")
        .setRequired(true)
        .setMinValue(1)
    ),
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
    .setName("noitu-tao")
    .setDescription("Mở ván Nối Từ bằng slash command nếu cần.")
    .addStringOption((option) =>
      option
        .setName("tu_goi_y")
        .setDescription("Cụm mở đầu nếu bạn muốn tự chọn")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("noitu-trangthai")
    .setDescription("Xem trạng thái ván Nối Từ hiện tại."),
  new SlashCommandBuilder()
    .setName("noitu-dung")
    .setDescription("Kết thúc ván Nối Từ hiện tại."),
  new SlashCommandBuilder()
    .setName("vuatiengviet-trangthai")
    .setDescription("Xem trạng thái ván Vua Tiếng Việt hiện tại."),
  new SlashCommandBuilder()
    .setName("vuatiengviet-dung")
    .setDescription("Kết thúc ván Vua Tiếng Việt hiện tại."),
  new SlashCommandBuilder()
    .setName("taixiu-trangthai")
    .setDescription("Xem trạng thái kèo Tài Xỉu hiện tại."),
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
    ),
  new SlashCommandBuilder()
    .setName("admin-vttv-pending")
    .setDescription("Xem danh sách câu đố Vua Tiếng Việt đang chờ duyệt.")
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription("Số mục muốn xem")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(20)
    )
  ,
  new SlashCommandBuilder()
    .setName("monthly")
    .setDescription("Xem bang ung vien thuong thang hien tai."),
  new SlashCommandBuilder()
    .setName("admin-monthly-status")
    .setDescription("Xem trang thai xet thuong thang hien tai."),
  new SlashCommandBuilder()
    .setName("admin-monthly-award")
    .setDescription("Ghi nhan thuong thang cho mot player.")
    .addStringOption((option) =>
      option
        .setName("user_id")
        .setDescription("Discord user ID cua player")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("ghi_chu")
        .setDescription("Ghi chu xet thuong")
        .setRequired(false)
    )
];

const commandData = commandBuilders.map((builder) => builder.toJSON());

module.exports = {
  commandBuilders,
  commandData
};
