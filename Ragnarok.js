global.Promise = require('bluebird');

const commando = require('discord.js-commando');
const Currency = require('./currency/Currency');
const Experience = require('./currency/Experience');
const { oneLine } = require('common-tags');
const path = require('path');
const Raven = require('raven');
const winston = require('winston');
const log = require('./functions/log.js');

const Database = require('./postgreSQL/PostgreSQL');
const Redis = require('./redis/Redis');
const SequelizeProvider = require('./postgreSQL/SequelizeProvider');
const config = require('./settings');

const database = new Database();
const redis = new Redis();
const client = new commando.Client({
	owner: config.owner,
	commandPrefix: '?',
	unknownCommandResponse: false,
	disableEveryone: true
});

let earnedRecently = [];
let gainedXPRecently = [];

Raven.config(config.ravenKey);
Raven.install();

database.start();
redis.start();

client.setProvider(new SequelizeProvider(database.db));

client.dispatcher.addInhibitor(msg => {
	const blacklist = client.provider.get('global', 'userBlacklist', []);
	if (!blacklist.includes(msg.author.id)) return false;
	return `User ${msg.author.username}#${msg.author.discriminator} (${msg.author.id}) has been blacklisted.`;
});

client.on('error', winston.error)
	.on('warn', winston.warn)
	.on('ready', () => {
		const logger = oneLine`Client ready... Logged in as ${client.user.username}#${client.user.discriminator} (${client.user.id})`;
		winston.info(log(logger, 'log'));
		Currency.leaderboard();
	})
	.on('disconnect', () => { winston.warn(log('Disconnected!', 'error')); })
	.on('reconnect', () => { winston.warn(log('Reconnecting...', 'warn')); })
	.on('commandRun', (cmd, promise, msg, args) => {
		const logger = oneLine`${msg.author.username}#${msg.author.discriminator} (${msg.author.id})
			> ${msg.guild ? `${msg.guild.name} (${msg.guild.id})` : 'DM'}
			>> ${cmd.groupID}:${cmd.memberName}
			${Object.values(args)[0] !== '' ? `>>> ${Object.values(args)}` : ''}`;
		winston.info(log(logger, 'log'));
	})

	.on('guildMemberAdd', (member) => {
		let guild = member.guild;
		guild.defaultChannel.sendMessage(`Please welcome ${member.user} to the server!`);
		const logger = `GUILD MEMBER ADD: ${member.user.username}#${member.user.discriminator} (${member.id}) has joined the guild ${guild.name} (${guild.id})`;
		winston.info(log(logger, 'log'));
	})

	.on('message', async (message) => {
		if (message.channel.type === 'dm') return;

		const channelLocks = client.provider.get(message.guild.id, 'locks', []);
		if (channelLocks.includes(message.channel.id)) return;
		if (message.author.bot) return;

		if (!earnedRecently.includes(message.author.id)) {
			const hasImageAttachment = message.attachments.some(attachment => {
				return attachment.url.match(/\.(png|jpg|jpeg|gif|webp)$/);
			});
			const moneyEarned = hasImageAttachment
				? Math.ceil(Math.random() * 7) + 1
				: Math.ceil(Math.random() * 7) + 5;

			Currency._changeBalance(message.author.id, moneyEarned);

			earnedRecently.push(message.author.id);
			setTimeout(() => {
				const index = earnedRecently.indexOf(message.author.id);
				earnedRecently.splice(index, 1);
			}, 8000);
		}

		if (!gainedXPRecently.includes(message.author.id)) {
			const xpEarned = Math.ceil(Math.random() * 9) + 3;
			const oldLevel = await Experience.getLevel(message.author.id);
			Experience.addExperience(message.author.id, xpEarned).then(async () => {
				const newLevel = await Experience.getLevel(message.author.id);

				if (newLevel > oldLevel) {
					Currency._changeBalance(message.author.id, 100 * newLevel);
				}
			}).catch(winston.error);

			gainedXPRecently.push(message.author.id);
			setTimeout(() => {
				const index = gainedXPRecently.indexOf(message.author.id);
				gainedXPRecently.splice(index, 1);
			}, 60 * 1000);
		}
	})

	.on('commandError', (cmd, err) => {
		if (err instanceof commando.FriendlyError) return;
		const logger = (`Error in command ${cmd.groupID}:${cmd.memberName}`, err);
		winston.error(log(logger, 'error'));
	})

	.on('commandBlocked', (msg, reason) => {
		const logger = oneLine`
			Command ${msg.command ? `${msg.command.groupID}:${msg.command.memberName}` : ''}
			blocked; User ${msg.author.username}#${msg.author.discriminator} (${msg.author.id}): ${reason}`;
		winston.info(log(logger, 'log'));
	})

	.on('commandPrefixChange', (guild, prefix) => {
		const logger = oneLine`
			Prefix changed to ${prefix || 'the default'}
			${guild ? `in guild ${guild.name} (${guild.id})` : 'globally'}.`;
		winston.info(log(logger, 'log'));
	})

	.on('commandStatusChange', (guild, command, enabled) => {
		const logger = oneLine`
			Command ${command.groupID}:${command.memberName}
			${enabled ? 'enabled' : 'disabled'}
			${guild ? `in guild ${guild.name} (${guild.id})` : 'globally'}.`;
		winston.info(log(logger, 'log'));
	})

	.on('groupStatusChange', (guild, group, enabled) => {
		const logger = oneLine`
			Group ${group.id}
			${enabled ? 'enabled' : 'disabled'}
			${guild ? `in guild ${guild.name} (${guild.id})` : 'globally'}.`;
		winston.info(log(logger, 'log'));
	});

client.registry
	.registerGroups([
		['info', 'Info'],
		['economy', 'Economy'],
		['social', 'Social'],
		['games', 'Games'],
		['item', 'Item'],
		['weather', 'Weather'],
		['music', 'Music'],
		['tags', 'Tags'],
		['moderator', 'Moderator']
	])
	.registerDefaults()
	.registerTypesIn(path.join(__dirname, 'types'))
	.registerCommandsIn(path.join(__dirname, 'commands'));

client.login(config.token);
