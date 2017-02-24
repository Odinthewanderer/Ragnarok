const { Command } = require('discord.js-commando');
const { stripIndents } = require('common-tags');

const Currency = require('../../currency/Currency');

module.exports = class MoneyTradeCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'trade',
			aliases: [
				'trade-money',
				'money-trade',
				`${Currency.textSingular}-trade`,
				`${Currency.textPlural}-trade`,
				`trade-${Currency.textSingular}`,
				`trade-${Currency.textPlural}`
			],
			group: 'economy',
			memberName: 'trade',
			description: `Trades the ${Currency.textPlural} you have earned.`,
			details: `Trades the amount of ${Currency.textPlural} you have earned.`,
			guildOnly: true,
			throttling: {
				usages: 2,
				duration: 3
			},

			args: [
				{
					key: 'member',
					prompt: `what user would you like to give ${Currency.textPlural}?\n`,
					type: 'member'
				},
				{
					key: 'currency',
					label: `amount of ${Currency.textPlural} to trade`,
					prompt: `how many ${Currency.textPlural} do you want to give that user?\n`,
					validate: currency => {
						return /^(?:\d+|-all)$/g.test(currency);
					},
					parse: async (currency, msg) => {
						const balance = await Currency.getBalance(msg.author.id);

						if (currency === '-all') return parseInt(balance);
						return parseInt(currency);
					}
				}
			]
		});
	}

	async run(msg, args) {
		const user = args.member;
		const currency = args.currency;

		if (user.id === msg.author.id) return msg.reply(`you can't trade ${Currency.textPlural} with yourself, ya dingus.`);
		if (user.user.bot) return msg.reply(`don't give your ${Currency.textPlural} to bots: they're bots, man.`);
		if (currency <= 0) return msg.reply(`you can't trade 0 or less ${Currency.convert(0)}.`);

		const userBalance = await Currency.getBalance(msg.author.id);

		if (userBalance < currency) {
			return msg.reply(stripIndents`
				you don't have that many ${Currency.textPlural} to trade!
				You currently have ${Currency.convert(userBalance)} on hand.
			`);
		}

		Currency.removeBalance(msg.author.id, currency);
		Currency.addBalance(user.id, currency);

		return msg.reply(`${user.displayName} successfully received your ${Currency.convert(currency)}!`);
	}
};
