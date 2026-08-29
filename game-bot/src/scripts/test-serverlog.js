const { buildMemberLeaveEmbed } = require("../lib/serverlog-announcer");

function fakeRole(id, position) {
  return { id, position };
}

function main() {
  const member = {
    guild: { id: "guild-test", name: "Jianghu Test" },
    user: {
      id: "123456789012345678",
      username: "Tester",
      tag: "Tester#0001",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      displayAvatarURL: () => "https://cdn.discordapp.com/avatar.png"
    },
    joinedAt: new Date("2026-02-01T00:00:00.000Z"),
    roles: {
      cache: new Map([
        ["guild-test", fakeRole("guild-test", 0)],
        ["role-a", fakeRole("role-a", 2)],
        ["role-b", fakeRole("role-b", 1)]
      ])
    }
  };

  const embed = buildMemberLeaveEmbed(member).toJSON();
  if (!embed.title?.includes("rời server")) {
    throw new Error("Serverlog leave embed title is wrong");
  }
  if (!embed.description?.includes(member.user.id)) {
    throw new Error("Serverlog leave embed does not mention user");
  }
  if (!embed.fields?.some((field) => field.name === "Role trước khi rời" && field.value.includes("role-a"))) {
    throw new Error("Serverlog leave embed does not include previous roles");
  }

  console.log(JSON.stringify({ ok: true, title: embed.title, fields: embed.fields.length }, null, 2));
}

main();
