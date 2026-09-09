const { buildMemberLeaveEmbed } = require("../lib/serverlog-announcer");
const assert = require("node:assert/strict");
const { Client, Events, GatewayIntentBits, Partials, Status } = require("discord.js");

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
  if (!embed.fields?.some((field) => field.name.includes("Role trước khi rời") && field.value.includes("role-a"))) {
    throw new Error("Serverlog leave embed does not include previous roles");
  }
  if (!embed.thumbnail?.url || !embed.footer?.text?.includes("Jianghu Server Log")) {
    throw new Error("Serverlog leave embed is missing visual metadata");
  }

  console.log(JSON.stringify({ ok: true, title: embed.title, fields: embed.fields.length }, null, 2));
}

async function testDelivery() {
  const store = require("../storage/serverlog-room-store");
  const originalGetRoom = store.getRoom;
  const announcerPath = require.resolve("../lib/serverlog-announcer");
  let room = { channelId: "123456789012345679" };
  store.getRoom = () => room;
  delete require.cache[announcerPath];
  const { announceMemberLeave } = require(announcerPath);
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
    partials: [Partials.GuildMember]
  });
  try {
    const guild = client.guilds._add({ id: "123456789012345678", name: "Test", member_count: 5 });
    let removed;
    client.on(Events.GuildMemberRemove, (member) => { removed = member; });
    let sent = 0;
    client.channels.fetch = async () => ({ send: async (payload) => {
      assert.equal(payload.embeds.length, 1);
      sent++;
    } });
    for (const bot of [true, false]) {
      const id = bot ? "223456789012345678" : "323456789012345678";
      assert.equal(guild.members.cache.has(id), false);
      removed = null;
      client.actions.GuildMemberRemove.handle({
        guild_id: guild.id,
        user: { id, username: "Departed", discriminator: "0", avatar: null, bot }
      }, { status: Status.Ready });
      assert.ok(removed, "Uncached member removal must emit event");
      assert.equal(await announceMemberLeave(removed), true);
    }
    assert.equal(sent, 2);
    client.channels.fetch = async () => ({ send: async () => { throw new Error("Missing Permissions"); } });
    assert.equal(await announceMemberLeave(removed), false);
    client.channels.fetch = async () => { throw new Error("Unknown Channel"); };
    assert.equal(await announceMemberLeave(removed), false);
    room = null;
    assert.equal(await announceMemberLeave(removed), false);
    console.log("PASS: uncached bot/user removal, delivery, permission failure, deleted channel, missing room");
  } finally {
    store.getRoom = originalGetRoom;
    delete require.cache[announcerPath];
    await client.destroy();
  }
}

main();
testDelivery().catch((error) => { console.error(error); process.exitCode = 1; });
