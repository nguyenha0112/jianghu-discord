const { EmbedBuilder } = require("discord.js");
const { getRoom } = require("../storage/serverlog-room-store");

function buildMemberLeaveEmbed(member) {
  const user = member.user;
  const joinedAt = member.joinedAt ? Math.floor(member.joinedAt.getTime() / 1000) : null;
  const createdAt = user.createdAt ? Math.floor(user.createdAt.getTime() / 1000) : null;
  const leftAt = Math.floor(Date.now() / 1000);
  const roleValues = member.roles?.cache?.values ? [...member.roles.cache.values()] : [];
  const roles = roleValues
    .filter((role) => role.id !== member.guild.id)
    .sort((left, right) => right.position - left.position)
    .map((role) => `<@&${role.id}>`)
    .slice(0, 12);
  const displayName = member.displayName || user.globalName || user.username || "Không rõ";
  const avatarUrl = user.displayAvatarURL?.({ size: 256 }) || undefined;

  const embed = new EmbedBuilder()
    .setColor(0xff6b6b)
    .setAuthor({
      name: user.tag || user.username,
      iconURL: avatarUrl
    })
    .setTitle("🚪 Thành viên đã rời server")
    .setDescription([
      `**${displayName}** vừa rời khỏi **${member.guild.name}**.`,
      `Mention: <@${user.id}>`
    ].join("\n"))
    .addFields(
      { name: "🆔 User ID", value: user.id, inline: true },
      { name: "⏳ Đã vào server", value: joinedAt ? `<t:${joinedAt}:R>` : "Không rõ", inline: true },
      { name: "🕰️ Rời lúc", value: `<t:${leftAt}:F>`, inline: true },
      { name: "📅 Tài khoản tạo", value: createdAt ? `<t:${createdAt}:R>` : "Không rõ", inline: true },
      { name: "🏷️ Số role giữ trước khi rời", value: String(roles.length), inline: true }
    )
    .setThumbnail(avatarUrl)
    .setFooter({ text: "Jianghu Server Log • Member Leave" })
    .setTimestamp(new Date(leftAt * 1000));

  if (roles?.length) {
    embed.addFields({ name: "🎭 Role trước khi rời", value: roles.join(" "), inline: false });
  }

  return embed;
}

async function announceMemberLeave(member) {
  const room = getRoom(member.guild.id);
  if (!room?.channelId) {
    console.log("[serverlog] member leave skipped: no channel configured", {
      guildId: member.guild.id,
      userId: member.user.id
    });
    return false;
  }

  const channel = await member.client.channels.fetch(room.channelId).catch((error) => {
    console.warn("[serverlog] cannot fetch leave channel", {
      guildId: member.guild.id,
      channelId: room.channelId,
      message: error.message
    });
    return null;
  });

  if (!channel?.send) {
    console.warn("[serverlog] leave channel is not sendable", {
      guildId: member.guild.id,
      channelId: room.channelId,
      userId: member.user.id
    });
    return false;
  }

  await channel.send({ embeds: [buildMemberLeaveEmbed(member)] }).catch((error) => {
    console.error("[serverlog] failed to send member leave log", {
      guildId: member.guild.id,
      channelId: room.channelId,
      userId: member.user.id,
      message: error.message
    });
  });

  console.log("[serverlog] member leave sent", {
    guildId: member.guild.id,
    channelId: room.channelId,
    userId: member.user.id
  });
  return true;
}

module.exports = {
  announceMemberLeave,
  buildMemberLeaveEmbed
};
