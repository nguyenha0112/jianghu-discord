const path = require("node:path");
const { AttachmentBuilder } = require("discord.js");

const currencyDir = path.join(__dirname, "..", "..", "assets", "currency");

function buildCurrencyAttachment(fileName, attachmentName = fileName) {
  return new AttachmentBuilder(path.join(currencyDir, fileName), { name: attachmentName });
}

function buildCurrencyPairAttachment(attachmentName = "currencies.png") {
  return buildCurrencyAttachment("currencies.png", attachmentName);
}

function buildXuAttachment(attachmentName = "xu.png") {
  return buildCurrencyAttachment("xu.png", attachmentName);
}

function buildNgocAttachment(attachmentName = "ngoc.png") {
  return buildCurrencyAttachment("ngoc.png", attachmentName);
}

module.exports = {
  buildCurrencyAttachment,
  buildCurrencyPairAttachment,
  buildXuAttachment,
  buildNgocAttachment
};
