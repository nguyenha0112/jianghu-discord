const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { equipArtifact, getArtifactStatus, unequipArtifact } = require("../services/game-service");
const { emojiToTwemojiUrl, getProfessionTheme } = require("../lib/ui-theme");
const artifacts = require("../config/artifacts");

const artifactChoices = Object.values(artifacts).map((artifact) => ({
  name: artifact.name,
  value: artifact.itemId
}));

module.exports = {
  data: new SlashCommandBuilder()
    .setName("phapbao")
    .setDescription("Xem va trang bi phap bao.")
    .addStringOption((option) =>
      option
        .setName("hanh_dong")
        .setDescription("Thao tac muon thuc hien")
        .setRequired(false)
        .addChoices(
          { name: "Xem pháp bảo", value: "xem" },
          { name: "Trang bị pháp bảo", value: "trangbi" },
          { name: "Tháo pháp bảo", value: "thao" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("phap_bao")
        .setDescription("Chon phap bao muon trang bi")
        .setRequired(false)
        .addChoices(...artifactChoices)
    ),
  async execute(interaction) {
    const action = interaction.options.getString("hanh_dong") || "xem";
    const artifactId = interaction.options.getString("phap_bao");

    if (action === "trangbi") {
      if (!artifactId) {
        await interaction.reply("Hãy chọn mục `phap_bao` để bot biết bạn muốn trang bị món nào.");
        return;
      }

      const result = await equipArtifact(interaction.user.id, interaction.user.username, artifactId);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(result.ok ? 0x2ecc71 : 0xe74c3c)
            .setTitle(result.ok ? "🗡️ Trang Bị Thành Công" : "🗡️ Trang Bị Thất Bại")
            .setThumbnail(emojiToTwemojiUrl("🗡️"))
            .setDescription(result.message)
        ]
      });
      return;
    }

    if (action === "thao") {
      const result = await unequipArtifact(interaction.user.id, interaction.user.username);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(result.ok ? 0xf1c40f : 0xe74c3c)
            .setTitle(result.ok ? "🧳 Đã Tháo Pháp Bảo" : "🧳 Không Thể Tháo")
            .setThumbnail(emojiToTwemojiUrl("🧳"))
            .setDescription(result.message)
        ]
      });
      return;
    }

    const status = await getArtifactStatus(interaction.user.id, interaction.user.username);
    const lines = status.ownedArtifacts.length
      ? status.ownedArtifacts.map((artifact) => {
          const theme = getProfessionTheme(artifact.favoredProfession);
          return `${artifact.emoji} **${artifact.name}**\nHợp với: ${theme.emoji} ${theme.name}\nBuff: +${Math.round((artifact.xuMultiplier - 1) * 100)}% Xu, +${Math.round((artifact.professionXpMultiplier - 1) * 100)}% XP đạo tu`;
        })
      : ["Chưa sở hữu pháp bảo nào."];

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle("🗡️ Pháp Bảo Hộ Thân")
          .setThumbnail(emojiToTwemojiUrl("🗡️"))
          .setDescription([`**Đang trang bị:** ${status.equippedArtifact ? `${status.equippedArtifact.emoji} ${status.equippedArtifact.name}` : "Chưa có"}`, "", ...lines].join("\n"))
          .setFooter({ text: "Dùng /phapbao rồi chọn 'hanh_dong: Trang bị pháp bảo' và mục 'phap_bao' để trang bị." })
      ]
    });
  }
};
