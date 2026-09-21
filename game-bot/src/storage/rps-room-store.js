const { createRoomStore } = require("./create-room-store");

module.exports = createRoomStore({
  gameKey: "rock_paper_scissors",
  fileName: "rps-rooms.json"
});
