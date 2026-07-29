const { createRoomStore } = require("./create-room-store");

module.exports = createRoomStore({
  gameKey: "word_chain",
  fileName: "word-chain-rooms.json",
  defaults: {
    mode: "pvp"
  }
});
