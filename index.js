require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, PermissionsBitField } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans
  ]
});

// ─── Config ────────────────────────────────────────────────
const PREFIX = '?';

// Your guild id (instant slash commands)
const GUILD_ID = '1340471009094139914';

// GIF patterns — very aggressive now
const GIF_PATTERNS = [
  '.gif',
  'tenor.com',
  'giphy.com',
  'gfycat.com',
  '.webp?width=',
  'c.tenor.com',
  'media.tenor.com',
  'media1.tenor.com',
  'media.giphy.com',
  'i.giphy.com',
  'gifv',
  'imgur.com',
  '.gif?'
];

// Whitelists & blacklists
const whitelistedGIFs = new Set();
const blacklistedWords = new Set();
const whitelistedExceptions = new Set();

// Roles that bypass everything
const allowedRoleNames = (process.env.ALLOWED_ROLES || 'Admin,Moderator').split(',').map(r => r.trim().toLowerCase());
const AUTOMOD_BYPASS_ROLE = 'automod bypass';

client.once('ready', async () => {
  console.log(`Vurah Bot online! Prefix: ${PREFIX} | Tag: ${client.user.tag}`);

  const commands = [
    // GIF commands
    new SlashCommandBuilder()
      .setName('allowgif')
      .setDescription('Whitelist a specific GIF link')
      .addStringOption(opt => opt.setName('url').setDescription('Exact link').setRequired(true)),

    new SlashCommandBuilder()
      .setName('blockgif')
      .setDescription('Block a specific GIF link')
      .addStringOption(opt => opt.setName('url').setDescription('Exact link').setRequired(true)),

    new SlashCommandBuilder()
      .setName('listgifs')
      .setDescription('Show all whitelisted GIF links'),

    // Automod management
    new SlashCommandBuilder()
      .setName('setupautomod')
      .setDescription('Show current blacklisted words & how to manage'),

    new SlashCommandBuilder()
      .setName('addword')
      .setDescription('Add word/phrase to blacklist')
      .addStringOption(opt => opt.setName('word').setDescription('The word or phrase').setRequired(true)),

    new SlashCommandBuilder()
      .setName('removeword')
      .setDescription('Remove word/phrase from blacklist')
      .addStringOption(opt => opt.setName('word').setDescription('The word or phrase').setRequired(true)),

    // Hard ban / unban
    new SlashCommandBuilder()
      .setName('hardban')
      .setDescription('Permanently ban user + delete 7 days messages')
      .addUserOption(opt => opt.setName('user').setDescription('@user to ban').setRequired(true)),

    new SlashCommandBuilder()
      .setName('hardunban')
      .setDescription('Unban user by ID')
      .addStringOption(opt => opt.setName('userid').setDescription('User ID').setRequired(true))
  ];

  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (guild) {
      await guild.commands.set(commands);
      console.log(`All slash commands registered in guild ${GUILD_ID}`);
    } else {
      console.error(`Guild ${GUILD_ID} not found`);
    }
  } catch (error) {
    console.error('Slash registration failed:', error);
  }
});

// ─── Slash Commands ────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    return interaction.reply({ content: "Only moderators can use this.", ephemeral: true });
  }

  const { commandName, options } = interaction;

  // GIF whitelist
  if (commandName === 'allowgif') {
    const url = options.getString('url').trim();
    whitelistedGIFs.add(url);
    return interaction.reply({ content: `**${url}** → whitelisted`, ephemeral: false });
  }

  // GIF blacklist
  if (commandName === 'blockgif') {
    const url = options.getString('url').trim();
    whitelistedGIFs.delete(url);
    return interaction.reply({ content: `**${url}** → blocked`, ephemeral: false });
  }

  // List whitelisted GIFs
  if (commandName === 'listgifs') {
    const list = whitelistedGIFs.size ? Array.from(whitelistedGIFs).join('\n') : 'Empty';
    return interaction.reply({ content: `Whitelisted GIFs:\n${list}`, ephemeral: true });
  }

  // Setup / view lists
  if (commandName === 'setupautomod') {
    const bad = blacklistedWords.size ? Array.from(blacklistedWords).join('\n') : 'None';
    const good = whitelistedExceptions.size ? Array.from(whitelistedExceptions).join('\n') : 'None';

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('Automod Status')
      .addFields(
        { name: 'Blacklisted words', value: bad || 'None', inline: false },
        { name: 'Whitelisted exceptions', value: good || 'None', inline: false }
      )
      .setFooter({ text: `Prefix backup: ${PREFIX}` });

    return interaction.reply({ embeds: [embed], ephemeral: false });
  }

  // Add word
  if (commandName === 'addword') {
    const word = options.getString('word').trim().toLowerCase();
    blacklistedWords.add(word);
    return interaction.reply({ content: `Added → **${word}**`, ephemeral: false });
  }

  // Remove word
  if (commandName === 'removeword') {
    const word = options.getString('word').trim().toLowerCase();
    if (blacklistedWords.delete(word)) {
      return interaction.reply({ content: `Removed → **${word}**`, ephemeral: false });
    }
    return interaction.reply({ content: `**${word}** not found`, ephemeral: true });
  }

  // Hardban
  if (commandName === 'hardban') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: "Missing Ban Members permission", ephemeral: true });
    }

    const user = options.getUser('user');
    try {
      await interaction.guild.bans.create(user.id, {
        deleteMessageSeconds: 604800,
        reason: `Hardban by ${interaction.user.tag}`
      });
      return interaction.reply({ content: `**Banned** ${user} (7 days messages deleted)` });
    } catch (e) {
      return interaction.reply({ content: `Failed: ${e.message}`, ephemeral: true });
    }
  }

  // Hardunban
  if (commandName === 'hardunban') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: "Missing Ban Members permission", ephemeral: true });
    }

    const id = options.getString('userid');
    try {
      await interaction.guild.bans.remove(id, `Unban by ${interaction.user.tag}`);
      return interaction.reply({ content: `**Unbanned** <@${id}>` });
    } catch (e) {
      return interaction.reply({ content: `Failed: ${e.message}`, ephemeral: true });
    }
  }
});

// ─── Message handling + Auto deletion ───────────────────────
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const member = message.member;

  // Full bypass checks
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
  if (allowedRoleNames.some(r => member.roles.cache.has(r))) return;
  if (member.roles.cache.some(r => r.name.toLowerCase() === AUTOMOD_BYPASS_ROLE)) return;

  const content = message.content.trim();
  const lower = content.toLowerCase();

  let shouldDelete = false;
  let reason = '';
  let detected = '';

  // 1. Attachments (uploaded .gif / animated webp)
  for (const att of message.attachments.values()) {
    const u = att.url.toLowerCase();
    if (u.endsWith('.gif') || u.includes('.gif?') || (u.endsWith('.webp') && u.includes('animation'))) {
      shouldDelete = true;
      reason = 'Uploaded GIF';
      break;
    }
  }

  // 2. Raw links in message
  if (!shouldDelete && GIF_PATTERNS.some(p => lower.includes(p))) {
    shouldDelete = true;
    reason = 'GIF link';
  }

  // 3. Embedded GIFs — very strong detection
  if (!shouldDelete) {
    for (const embed of message.embeds) {
      const urls = [
        embed.url || '',
        embed.image?.url || '',
        embed.thumbnail?.url || '',
        embed.video?.url || '',
        embed.provider?.url || ''
      ].map(u => u.toLowerCase());

      const isGifEmbed =
        urls.some(u =>
          u.includes('tenor') ||
          u.includes('giphy') ||
          u.includes('c.tenor.com') ||
          u.includes('media.tenor.com') ||
          u.includes('media.giphy.com') ||
          u.includes('i.giphy.com') ||
          u.endsWith('.gif') ||
          u.includes('.gif?') ||
          u.includes('gifv')
        ) ||
        (embed.provider?.name?.toLowerCase?.()?.includes('tenor')) ||
        (embed.provider?.name?.toLowerCase?.()?.includes('giphy'));

      if (isGifEmbed) {
        shouldDelete = true;
        reason = 'Embedded GIF';
        break;
      }
    }
  }

  // Whitelist check
  if (shouldDelete && whitelistedGIFs.has(message.content.trim())) {
    shouldDelete = false;
  }

  // Word blacklist check
  if (!shouldDelete) {
    for (const bad of blacklistedWords) {
      if (lower.includes(bad)) {
        shouldDelete = true;
        reason = 'Blacklisted word';
        detected = bad;
        break;
      }
    }
  }

  // Delete + send visible message
  if (shouldDelete) {
    try {
      await message.delete();

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('Message Removed')
        .setDescription(`**Reason:** ${reason}${detected ? ` (${detected})` : ''}`)
        .setFooter({ text: 'Vurah Bot • AutoMod' })
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });
    } catch (e) {
      console.error('Could not delete message:', e);
    }
  }
});

client.login(process.env.TOKEN);
