const { SlashCommandBuilder } = require("discord.js");
const { assertCanManageGameRoom } = require("../lib/room-admin");
const { enableRoom: enableWordChainRoom, disableRoom: disableWordChainRoom } = require("../storage/word-chain-room-store");
const { enableRoom: enableVietnameseKingRoom, disableRoom: disableVietnameseKingRoom } = require("../storage/vietnamese-king-room-store");
const { enableRoom: enableTaiXiuRoom, disableRoom: disableTaiXiuRoom } = require("../storage/taixiu-room-store");
const { enableRoom: enableBauCuaRoom, disableRoom: disableBauCuaRoom } = require("../storage/baucua-room-store");
const { enableRoom: enableXiDachRoom, disableRoom: disableXiDachRoom } = require("../storage/xidach-room-store");
const {
  enableRoomPersistent: enableLevelUpRoomPersistent,
  disableRoom: disableLevelUpRoom
} = require("../storage/levelup-room-store");
const {
  enableRoomPersistent: enableServerLogRoomPersistent,
  disableRoom: disableServerLogRoom
} = require("../storage/serverlog-room-store");

function roomMeta(interaction) {
  return {
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    channelName: interaction.channel?.name || "unknown",
    createdByUserId: interaction.user.id,
    createdByUsername: interaction.user.username
  };
}

async function setTopic(interaction, topic) {
  if (interaction.channel && typeof interaction.channel.setTopic === "function") {
    await interaction.channel.setTopic(topic).catch(() => {});
  }
}

async function sendGuide(interaction, title, description, color) {
  await interaction.channel?.send?.({
    embeds: [{ color, title, description }]
  }).catch(() => {});
}

function formatSetupResult(successMessage, result) {
  if (result.persisted) {
    return successMessage;
  }
  return "Tạo lỗi, vui lòng liên hệ Lục Hà.";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Bảng quản trị nhanh để tạo/xóa phòng game và log.")
    .addStringOption((option) =>
      option
        .setName("hanh_dong")
        .setDescription("Chọn việc quản trị muốn làm")
        .setRequired(true)
        .addChoices(
          { name: "Tạo phòng Nối Từ PvE", value: "noitu_pve" },
          { name: "Tạo phòng Nối Từ PvP", value: "noitu_pvp" },
          { name: "Xóa phòng Nối Từ", value: "noitu_xoa" },
          { name: "Tạo phòng Vua Tiếng Việt", value: "vttv_tao" },
          { name: "Xóa phòng Vua Tiếng Việt", value: "vttv_xoa" },
          { name: "Tạo phòng Tài Xỉu", value: "taixiu_tao" },
          { name: "Xóa phòng Tài Xỉu", value: "taixiu_xoa" },
          { name: "Tạo phòng Bầu Cua", value: "baucua_tao" },
          { name: "Xóa phòng Bầu Cua", value: "baucua_xoa" },
          { name: "Tạo phòng Xì Dách", value: "xidach_tao" },
          { name: "Xóa phòng Xì Dách", value: "xidach_xoa" },
          { name: "Tạo phòng thông báo lên cấp", value: "levelup_tao" },
          { name: "Xóa phòng thông báo lên cấp", value: "levelup_xoa" },
          { name: "Tạo phòng log người rời server", value: "serverlog_tao" },
          { name: "Xóa phòng log người rời server", value: "serverlog_xoa" }
        )
    ),
  async execute(interaction) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }

      assertCanManageGameRoom(interaction);
      const action = interaction.options.getString("hanh_dong", true);
      const meta = roomMeta(interaction);

      if (action === "noitu_pve" || action === "noitu_pvp") {
        const mode = action === "noitu_pvp" ? "pvp" : "pve";
        enableWordChainRoom(interaction.channelId, { ...meta, mode });
        await setTopic(interaction, `Nối Từ ${mode.toUpperCase()} | !play mở ván | !trangthai xem bảng | !stop kết thúc | !help xem luật`);
        await interaction.editReply(`Đã bật <#${interaction.channelId}> thành phòng Nối Từ ${mode.toUpperCase()}.`);
        return;
      }

      if (action === "noitu_xoa") {
        disableWordChainRoom(interaction.channelId);
        await interaction.editReply(`Đã xóa cấu hình Nối Từ ở <#${interaction.channelId}>.`);
        return;
      }

      if (action === "vttv_tao") {
        enableVietnameseKingRoom(interaction.channelId, meta);
        await setTopic(interaction, "Vua Tiếng Việt | !play mở ván | !goiy xem gợi ý | !trangthai xem bảng | !stop kết thúc");
        await interaction.editReply(`Đã bật <#${interaction.channelId}> thành phòng Vua Tiếng Việt.`);
        return;
      }

      if (action === "vttv_xoa") {
        disableVietnameseKingRoom(interaction.channelId);
        await interaction.editReply(`Đã xóa cấu hình Vua Tiếng Việt ở <#${interaction.channelId}>.`);
        return;
      }

      if (action === "taixiu_tao") {
        enableTaiXiuRoom(interaction.channelId, meta);
        await setTopic(interaction, "Tài Xỉu | !play mở kèo | bấm nút để đặt cược | !trangthai xem bảng | !chot lắc");
        await sendGuide(interaction, "Hướng dẫn phòng Tài Xỉu", "Nhắn `!play` để mở kèo, sau đó bấm nút hoặc dùng lệnh cược nhanh.", 0xe67e22);
        await interaction.editReply(`Đã bật <#${interaction.channelId}> thành phòng Tài Xỉu.`);
        return;
      }

      if (action === "taixiu_xoa") {
        disableTaiXiuRoom(interaction.channelId);
        await interaction.editReply(`Đã xóa cấu hình Tài Xỉu ở <#${interaction.channelId}>.`);
        return;
      }

      if (action === "baucua_tao") {
        enableBauCuaRoom(interaction.channelId, meta);
        await setTopic(interaction, "Bầu Cua | !play mở kèo | bấm nút để đặt cược | !trangthai xem bảng | !chot lắc");
        await sendGuide(interaction, "Hướng dẫn phòng Bầu Cua", "Nhắn `!play` để mở kèo, chọn Bầu/Cua/Tôm/Cá/Gà/Nai bằng nút.", 0x27ae60);
        await interaction.editReply(`Đã bật <#${interaction.channelId}> thành phòng Bầu Cua.`);
        return;
      }

      if (action === "baucua_xoa") {
        disableBauCuaRoom(interaction.channelId);
        await interaction.editReply(`Đã xóa cấu hình Bầu Cua ở <#${interaction.channelId}>.`);
        return;
      }

      if (action === "xidach_tao") {
        enableXiDachRoom(interaction.channelId, meta);
        await setTopic(interaction, "Xì Dách | !play mở bảng cược | Rút/Dừng để chơi | !stop hủy");
        await sendGuide(interaction, "Hướng dẫn phòng Xì Dách", "Nhắn `!play` để mở bảng cược, chọn mức cược rồi bấm Rút hoặc Dừng.", 0x8e44ad);
        await interaction.editReply(`Đã bật <#${interaction.channelId}> thành phòng Xì Dách.`);
        return;
      }

      if (action === "xidach_xoa") {
        disableXiDachRoom(interaction.channelId);
        await interaction.editReply(`Đã xóa cấu hình Xì Dách ở <#${interaction.channelId}>.`);
        return;
      }

      if (action === "levelup_tao") {
        const result = await enableLevelUpRoomPersistent(interaction.guildId, meta);
        await interaction.editReply(formatSetupResult(`Tạo thành công phòng thông báo lên cấp tại <#${interaction.channelId}>.`, result));
        return;
      }

      if (action === "levelup_xoa") {
        disableLevelUpRoom(interaction.guildId);
        await interaction.editReply("Đã tắt phòng thông báo lên cấp.");
        return;
      }

      if (action === "serverlog_tao") {
        const result = await enableServerLogRoomPersistent(interaction.guildId, meta);
        await interaction.editReply(formatSetupResult(`Tạo thành công phòng log người rời server tại <#${interaction.channelId}>.`, result));
        return;
      }

      if (action === "serverlog_xoa") {
        disableServerLogRoom(interaction.guildId);
        await interaction.editReply("Đã tắt phòng log người rời server.");
      }
    } catch (error) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: error.message });
      } else {
        await interaction.reply({ content: error.message, ephemeral: true });
      }
    }
  }
};
