const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getCultivationStatus, getProfile } = require("../services/game-service");
const { buildProgressBar, getPrimaryVisual, getProfessionTheme, getRealmTheme } = require("../lib/ui-theme");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Xem ho so tu tien cua ban."),
  async execute(interaction) {
    const player = await getProfile(interaction.user.id, interaction.user.username);
    const cultivation = await getCultivationStatus(interaction.user.id, interaction.user.username);
    const currentProfessionId = player.profession.current;
    const currentProfessionTheme = getProfessionTheme(currentProfessionId);
    const currentLevel = currentProfessionId ? player.profession.levels[currentProfessionId] || 1 : 0;
    const realmTheme = getRealmTheme(player.cultivation?.realm);
    const visuals = getPrimaryVisual(currentProfessionId, player.cultivation?.realm);

    const embed = new EmbedBuilder()
      .setColor(visuals.color)
      .setTitle(`${currentProfessionTheme.emoji} ${interaction.user.username} • Hồ Sơ Tu Tiên`)
      .setThumbnail(visuals.thumbnailUrl)
      .setDescription(
        [
          `**Cảnh giới:** ${realmTheme.emoji} ${cultivation.currentRealm.name}`,
          `**Đạo tu chính:** ${currentProfessionTheme.emoji} ${currentProfessionId ? currentProfessionTheme.name : "Chưa chọn"}`,
          `**Linh căn:** ${cultivation.spiritRoot.emoji} ${cultivation.spiritRoot.name}`,
          `**Động phủ:** ${cultivation.dwelling.emoji} ${cultivation.dwelling.name}`,
          `**Tiến độ tu vi:** \`${buildProgressBar(player.stats.playerXp, 100)}\` ${player.stats.playerXp}/100 XP`,
          `**Tiến độ đạo tu:** \`${buildProgressBar(player.profession.xp, 100)}\` ${player.profession.xp}/100 XP nghề`
        ].join("\n")
      )
      .addFields(
        { name: "🪙 Tài nguyên", value: `Xu **${player.wallet.xu}**\nNgọc **${player.wallet.ngoc}**`, inline: true },
        { name: "🌸 Tu vi", value: `Cấp **${player.stats.playerLevel}**\nXP **${player.stats.playerXp}**`, inline: true },
        { name: "🎒 Hành trang", value: `Loại vật phẩm **${Object.keys(player.inventory).length}**`, inline: true },
        { name: `${currentProfessionTheme.emoji} Đạo tu`, value: `${currentProfessionId ? currentProfessionTheme.name : "Chưa nhập đạo"}\nCấp **${currentLevel}**`, inline: true },
        { name: `${realmTheme.emoji} Cảnh giới`, value: `Hiện tại **${cultivation.currentRealm.name}**\nGiới hạn **${cultivation.currentRealm.levelCap}**`, inline: true },
        { name: "⚔️ Lực chiến", value: `HP **${cultivation.combat.hp}**\nCông **${cultivation.combat.attack}**\nThủ **${cultivation.combat.defense}**`, inline: true },
        { name: "💥 Chiến lực", value: `Bạo kích **${cultivation.combat.critRate}%**\nLực chiến **${cultivation.combat.power}**`, inline: true },
        { name: "✨ Mốc tiếp theo", value: cultivation.nextRealm ? `**${cultivation.nextRealm.name}**` : "Đã đạt cảnh giới cao nhất", inline: true }
      )
      .setFooter({ text: "Dùng /tutien để xem đầy đủ lộ trình cảnh giới, đạo tu và điều kiện đột phá." });

    await interaction.reply({ embeds: [embed] });
  }
};
