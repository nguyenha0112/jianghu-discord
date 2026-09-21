function parseAdminUserIds(value) {
  return [...new Set(String(value || "").split(",").map((id) => id.trim()).filter((id) => /^\d{16,20}$/.test(id)))];
}

function createDiscordAdminNotifier({ token, adminUserIds, fetchImpl = fetch }) {
  const userIds = parseAdminUserIds(adminUserIds);
  return async function notifyDiscordAdmins(content) {
    if (!token || userIds.length === 0) return { sent: 0, failed: 0 };
    const results = await Promise.allSettled(userIds.map(async (recipientId) => {
      const dmResponse = await fetchImpl("https://discord.com/api/v10/users/@me/channels", {
        method: "POST",
        headers: { authorization: `Bot ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ recipient_id: recipientId })
      });
      if (!dmResponse.ok) throw new Error(`Discord create DM HTTP ${dmResponse.status}`);
      const dmChannel = await dmResponse.json();
      const messageResponse = await fetchImpl(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
        method: "POST",
        headers: { authorization: `Bot ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ content: `⚠️ **Jianghu System**\n${content}`, allowed_mentions: { parse: [] } })
      });
      if (!messageResponse.ok) throw new Error(`Discord DM HTTP ${messageResponse.status}`);
    }));
    const sent = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.length - sent;
    if (failed) console.error("[alerts] failed to DM some admins", { sent, failed });
    return { sent, failed };
  };
}

module.exports = { createDiscordAdminNotifier, parseAdminUserIds };
