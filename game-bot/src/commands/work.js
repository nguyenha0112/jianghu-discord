const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { doWork } = require("../services/game-service");
const { emojiToTwemojiUrl, formatItemLabel, getProfessionTheme, getRealmTheme } = require("../lib/ui-theme");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("work")
    .setDescription("Tu luyện đạo tu hiện tại để nhận tài nguyên."),
  async execute(interaction) {
    const result = await doWork(interaction.user.id, interaction.user.username);
    if (!result.ok) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("⚠️ Tu Luyện Thất Bại")
            .setThumbnail(emojiToTwemojiUrl("⚠️"))
            .setDescription(result.message)
        ]
      });
      return;
    }

    const professionTheme = getProfessionTheme(result.player.profession.current);
    const realmTheme = getRealmTheme(result.player.cultivation?.realm);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(professionTheme.color)
          .setTitle(`${professionTheme.emoji} Tu Luyện Thành Công`)
          .setThumbnail(emojiToTwemojiUrl(professionTheme.emoji))
          .setDescription(`${result.profession.rewardText}\n\nBạn đang tu luyện theo nhánh **${professionTheme.name}**.`)
          .addFields(
            { name: "🪙 Thu hoạch", value: `+${result.reward.xuGain} Xu`, inline: true },
            { name: "🎁 Vật phẩm", value: formatItemLabel(result.reward.itemId, result.reward.quantity), inline: true },
            { name: "⚡ Kinh nghiệm", value: `+${result.reward.xpGain} XP đạo tu\n+${result.reward.playerXpGain} XP tu vi`, inline: true },
            { name: "🧬 Linh căn", value: `${result.reward.spiritRootName}${result.reward.spiritRootMatches ? "\nHợp mệnh, tu luyện hanh thông." : "\nKhông phải đạo tu hợp mệnh."}`, inline: true },
            { name: "🏡 Động phủ", value: `${result.reward.dwellingName}`, inline: true },
            { name: `${realmTheme.emoji} Cảnh giới`, value: `${result.reward.realmName}`, inline: true },
            { name: "📈 Giới hạn cấp", value: `${result.reward.realmCap}`, inline: true },
            { name: "🧭 Trạng thái", value: result.reward.realmCapReached ? `Đã chạm giới hạn. Dùng /dotpha để tiếp tục.` : "Có thể tiếp tục tu luyện.", inline: true }
          )
          .setFooter({ text: result.message || "Linh lực đang vận chuyển ổn định." })
      ]
    });
  }
};
