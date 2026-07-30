const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getCultivationStatus, getProfile } = require("../services/game-service");
const { buildProgressBar, getProfessionTheme, getRealmTheme } = require("../lib/ui-theme");
const { buildCurrencyPairAttachment } = require("../lib/currency-assets");

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
    const currencyAttachment = buildCurrencyPairAttachment();

    const embed = new EmbedBuilder()
      .setColor(realmTheme.color)
      .setTitle(`Ho so tu tien cua ${interaction.user.username}`)
      .setThumbnail("attachment://currencies.png")
      .setDescription(
        [
          `**Canh gioi:** ${cultivation.currentRealm.name}`,
          `**Dao tu chinh:** ${currentProfessionId ? currentProfessionTheme.name : "Chua chon"}`,
          `**Linh can:** ${cultivation.spiritRoot.name}`,
          `**Dong phu:** ${cultivation.dwelling.name}`,
          `**Tien do tu vi:** \`${buildProgressBar(player.stats.playerXp, 100)}\` ${player.stats.playerXp}/100 XP`,
          `**Tien do dao tu:** \`${buildProgressBar(player.profession.xp, 100)}\` ${player.profession.xp}/100 XP nghe`
        ].join("\n")
      )
      .addFields(
        { name: "Tai nguyen", value: `Xu **${player.wallet.xu}**\nNgoc **${player.wallet.ngoc}**`, inline: true },
        { name: "Tu vi", value: `Cap **${player.stats.playerLevel}**\nXP **${player.stats.playerXp}**`, inline: true },
        { name: "Hanh trang", value: `Loai vat pham **${Object.keys(player.inventory).length}**`, inline: true },
        { name: "Dao tu", value: `${currentProfessionId ? currentProfessionTheme.name : "Chua nhap dao"}\nCap **${currentLevel}**`, inline: true },
        { name: "Canh gioi", value: `Hien tai **${cultivation.currentRealm.name}**\nGioi han **${cultivation.currentRealm.levelCap}**`, inline: true },
        { name: "Luc chien", value: `HP **${cultivation.combat.hp}**\nCong **${cultivation.combat.attack}**\nThu **${cultivation.combat.defense}**`, inline: true },
        { name: "Suc manh", value: `Bao kich **${cultivation.combat.critRate}%**\nLuc chien **${cultivation.combat.power}**`, inline: true },
        { name: "Moc tiep theo", value: cultivation.nextRealm ? `**${cultivation.nextRealm.name}**` : "Da dat canh gioi cao nhat", inline: true }
      )
      .setFooter({ text: "Dung /tutien de xem day du lo trinh canh gioi, dao tu va dieu kien dot pha." });

    await interaction.reply({ embeds: [embed], files: [currencyAttachment] });
  }
};
