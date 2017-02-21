const { Command } = require('discord.js-commando');
const Currency = require('../../currency/Currency.js');
const { stripIndents } = require('common-tags');

module.exports = class LockAllCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'lock-all',
			group: 'economy',
			memberName: 'lock-all',
			description: `Disable xp and ${Currency.textSingular} earning on all channels in the server.`,
			guildOnly: true,
			throttling: {
				usages: 2,
				duration: 3
			}
		});
	}

	hasPermission(msg) {
		return msg.member.hasPermission('MANAGE_GUILD');
	}

	async run(msg) {
		const channels = msg.guild.channels.filter(channel => channel.type === 'text');
		const channelLocks = this.client.provider.get(msg.guild.id, 'locks', []);

		for (const channel of channels.values()) {
			if (channelLocks.includes(channel.id)) continue;

			channelLocks.push(channel.id);
		}

		this.client.provider.set(msg.guild.id, 'locks', channelLocks);

		return msg.reply(stripIndents`
			all channels on this server have been locked. You can no longer earn xp or ${Currency.textPlural} anywhere.
		`);
	}
};
