const { createRoomStore } = require("./create-room-store");

module.exports = createRoomStore({
  gameKey: "levelup_notifications",
  fileName: "levelup-rooms.json"
});
