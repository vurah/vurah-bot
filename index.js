require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, PermissionsBitField } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Config
const PREFIX = ',';  // comma prefix for setup/add/removeword

// GIF whitelists (unchanged)
const whitelistedGIFs = new Set();
const GIF_PATTERNS = [
  '.gif',
  'tenor.com',
  'giphy.com',
  'gfycat.com',
  '.webp?width='
];

// Automod words
const blacklistedWords = new Set();     // words/phrases that trigger deletion
const whitelistedExceptions = new Set(); // rare exceptions (keep message if contains this)

// Allowed roles bypass everything
const allowedRoleNames = (process.env.ALLOWED_ROLES || 'Admin,Moderator').split(',').map(r => r.trim().toLowerCase());

client.once('ready', async () => {
  console.log(`Vurahs Bot Prefix: ${PREFIX} | Tag: ${client.user.tag} 🐉🗑️`);

  // Register slash commands (only setup for automod + GIF ones)
  const commands = [
    // GIF commands
    new SlashCommandBuilder()
      .setName('allowgif')
      .setDescription('Whitelist a GIF link')
      .addStringOption(opt => opt.setName('url').setDescription('Exact link').setRequired(true)),
    new SlashCommandBuilder()
      .setName('blockgif')
      .setDescription('Block a GIF link')
      .addStringOption(opt => opt.setName('url').setDescription('Exact link').setRequired(true)),
    new SlashCommandBuilder()
      .setName('listgifs')
      .setDescription('List safe GIFs'),

    // New automod setup
    new SlashCommandBuilder()
      .setName('setupautomod')
      .setDescription('View automod word lists and how to manage them')
  ];

  await client.application.commands.set(commands);
  console.log('Slash commands ready!');
});

// Can user manage bot?
function canManage(member) {
  return member.permissions.has(PermissionsBitField.Flags.ManageMessages);
}

// Slash handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (!canManage(interaction.member)) {
    return interaction.reply({ content: "Mods only", ephemeral: true });
  }

  const { commandName, options } = interaction;

  if (commandName === 'allowgif') {
    const url = options.getString('url').trim();
    whitelistedGIFs.add(url);
    return interaction.reply({ content: ` **${url}** is safe `, ephemeral: false });
  }

  if (commandName === 'blockgif') {
    const url = options.getString('url').trim();
    whitelistedGIFs.delete(url);
    return interaction.reply({ content: ` **${url}** blocked! 🗑️`, ephemeral: false });
  }

  if (commandName === 'listgifs') {
    const list = whitelistedGIFs.size ? Array.from(whitelistedGIFs).map(u => `- ${u}`).join('\n') : 'None';
    return interaction.reply({ content: `**Safe GIFs:**\n${list}`, ephemeral: true });
  }

  if (commandName === 'setupautomod') {
    const badList = blacklistedWords.size ? Array.from(blacklistedWords).map(w => `- ${w}`).join('\n') : 'None yet!';
    const goodList = whitelistedExceptions.size ? Array.from(whitelistedExceptions).map(w => `- ${w}`).join('\n') : 'None';
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('Vurah Bot Automod Setup')
      .setDescription(`**Blacklisted words** (delete trigger):\n${badList}\n\n**Exceptions** (safe even with bad words):\n${goodList}\n\n**How to manage (use prefix , ):**\n`)
      .addFields(
        { name: `,addword <word>`, value: `Add to blacklist (e.g. ,addword nigger)`, inline: true },
        { name: `,removeword <word>`, value: `Remove from blacklist`, inline: true },
        { name: `,setup automod`, value: `Show this again`, inline: true }
      )
      .setFooter({ text: 'Vurah Bot - protecting your server!' });

    return interaction.reply({ embeds: [embed], ephemeral: false });
  }
});

// Prefix + deletion logic
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const member = message.member;
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

  const hasAllowedRole = member.roles.cache.some(role => allowedRoleNames.includes(role.name.toLowerCase()));
  if (hasAllowedRole) return;

  const content = message.content.trim();
  const lowerContent = content.toLowerCase();

  // Prefix commands
  if (content.startsWith(PREFIX)) {
    if (!canManage(member)) {
      return message.reply("Mods only for setup! 🚔").catch(() => {});
    }

    const args = content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    let reply = '';

    if (command === 'setup' && args[0]?.toLowerCase() === 'automod') {
      // Reuse the same embed logic as slash
      const badList = blacklistedWords.size ? Array.from(blacklistedWords).map(w => `- ${w}`).join('\n') : 'None yet!';
      const goodList = whitelistedExceptions.size ? Array.from(whitelistedExceptions).map(w => `- ${w}`).join('\n') : 'None';
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('Vurah Bot Automod Setup')
        .setDescription(`**Blacklisted words** (delete trigger):\n${badList}\n\n**Exceptions** (safe even with bad words):\n${goodList}\n\n**Commands:**\n`)
        .addFields(
          { name: `${PREFIX}addword <word>`, value: `Add to blacklist`, inline: true },
          { name: `${PREFIX}removeword <word>`, value: `Remove from blacklist`, inline: true },
          { name: `${PREFIX}setup automod`, value: `Show this`, inline: true }
        )
        .setFooter({ text: 'Vurah Bot' });

      return message.channel.send({ embeds: [embed] }).catch(() => {});
    }

    else if (command === 'add
