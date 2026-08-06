const { EmbedBuilder } = require("discord.js");
const { getRoom } = require("../storage/levelup-room-store");

function buildLevelUpEmbed(user, levelInfo, source = "Hoạt động") {
  return new EmbedBuilder()
    .setColor(0xffc857)
    .setAuthor({
      name: user.username || user.displayName || "Người chơi",
      iconURL: user.displayAvatarURL?.({ size: 128 }) || undefined
    })
    .setTitle("Lên cấp tu vi")
    .setDescription(`<@${user.id}> vừa lên cấp!`)
    .addFields(
      { name: "Cấp cũ", value: String(levelInfo.levelBefore), inline: true },
      { name: "Cấp mới", value: String(levelInfo.levelAfter), inline: true },
      { name: "XP hiện tại", value: `${levelInfo.xpAfter}/100`, inline: true },
      { name: "Nguồn", value: source, inline: false }
    )
    .setThumbnail(user.displayAvatarURL?.({ size: 256 }) || null)
    .setTimestamp();
}

async function announceLevelUp(client, guildId, user, levelInfo, source) {
  if (!levelInfo?.didLevelUp || !client || !guildId || !user?.id) {
    return false;
  }

  const room = getRoom(guildId);
  if (!room?.channelId) {
    return false;
  }

  const channel = await client.channels.fetch(room.channelId).catch(() => null);
  if (!channel?.send) {
    return false;
  }

  await channel.send({ embeds: [buildLevelUpEmbed(user, levelInfo, source)] }).catch(() => {});
  return true;
}

module.exports = {
  announceLevelUp,
  buildLevelUpEmbed
};
