const Discord = require('discord.js');

const client = new Discord.Client();
const token = process.env.token;
const build_channel = process.env.build_channel;

client.on('ready', () => {
  console.log("I'm in");
  console.log(client.user.username);
});

client.login(token);

function sendBuildInfo(build_info) {
  return client.channels.cache.get(build_channel).send(build_info);
}

module.exports = {
  loginDiscordClient: () => { return client.login(token) },
  sendBuildInfo: sendBuildInfo
}