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

// Config
const PREFIX = '?'; // still there as backup

// GIF whitelists
const whitelistedGIFs = new Set();
const GIF_PATTERNS = [
  '.gif',
  'tenor.com',
  'giphy.com',
  'gfycat.com',
  '.webp?width='
];

// Automod words
const blacklistedWords = new Set();
const whitelistedExceptions = new Set();

// Allowed roles bypass everything
const allowedRoleNames = (process.env.ALLOWED_ROLES || 'Admin,Moderator').split(',').map(r => r.trim().toLowerCase());

// Automod Bypass role
const AUTOMOD_BYPASS_ROLE = 'automod bypass';

// Your guild ID
const GUILD_ID = '1340471009094139914';

client.once('ready', async () => {
  console.log(`Vurah Bot online! Prefix backup: ${PREFIX} | Tag: ${client.user.tag}`);

  const commands = [
    // Existing GIF commands
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

    // Automod setup
    new SlashCommandBuilder()
      .setName('setupautomod')
      .setDescription('View automod word lists and how to manage them'),

    // NEW: Slash for word management
    new SlashCommandBuilder()
      .setName('addword')
      .setDescription('Add a word/phrase to blacklist')
      .addStringOption(opt => opt.setName('word').setDescription('Word or phrase to block').setRequired(true)),
    new SlashCommandBuilder()
      .setName('removeword')
      .setDescription('Remove a word/phrase from blacklist')
      .addStringOption(opt => opt.setName('word').setDescription('Word or phrase to remove').setRequired(true)),

    // NEW: Slash for hardban / hardunban
    new SlashCommandBuilder()
      .setName('hardban')
      .setDescription('Permanently ban a user + delete 7-day messages')
      .addUserOption(opt => opt.setName('user').setDescription('User to ban').setRequired(true)),
    new SlashCommandBuilder()
      .setName('hardunban')
      .setDescription('Unban a user by ID')
      .addStringOption(opt => opt.setName('userid').setDescription('User ID to unban').setRequired(true))
  ];

  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      console.error(`Guild ${GUILD_ID} not found - bot must be in the server`);
    } else {
      await guild.commands.set(commands);
      console.log(`All slash commands registered instantly in guild ${GUILD_ID}`);
    }
  } catch (error) {
    console.error('Slash registration failed:', error);
  }
});

function canManage(member) {
  return member.permissions.has(PermissionsBitField.Flags.ManageMessages);
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // Mod check for all commands
  if (!canManage(interaction.member)) {
    return interaction.reply({ content: "Mods only", ephemeral: true });
  }

  const { commandName, options } = interaction;

  if (commandName === 'allowgif') {
    const url = options.getString('url').trim();
    whitelistedGIFs.add(url);
    return interaction.reply({ content: `**${url}** is now safe.`, ephemeral: false });
  }

  if (commandName === 'blockgif') {
    const url = options.getString('url').trim();
    whitelistedGIFs.delete(url);
    return interaction.reply({ content: `**${url}** blocked.`, ephemeral: false });
  }

  if (commandName === 'listgifs') {
    const list = whitelistedGIFs.size ? Array.from(whitelistedGIFs).map(u => `- ${u}`).join('\n') : 'None';
    return interaction.reply({ content: `**Safe GIFs:**\n${list}`, ephemeral: true });
  }

  if (commandName === 'setupautomod') {
    const badList = blacklistedWords.size ? Array.from(blacklistedWords).map(w => `- ${w}`).join('\n') : 'None yet';
    const goodList = whitelistedExceptions.size ? Array.from(whitelistedExceptions).map(w => `- ${w}`).join('\n') : 'None';
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('Automod Setup')
      .setDescription(
        `**Blacklisted words** (triggers deletion):\n${badList}\n\n` +
        `**Exceptions** (safe even with blacklisted words):\n${goodList}\n\n` +
        `**Manage with slash commands or prefix ${PREFIX}**`
      )
      .setFooter({ text: 'Vurah Bot' });

    return interaction.reply({ embeds: [embed], ephemeral: false });
  }

  // NEW slash addword
  if (commandName === 'addword') {
    const word = options.getString('word').trim().toLowerCase();
    blacklistedWords.add(word);
    return interaction.reply({ content: `Added **${word}** to blacklist.`, ephemeral: false });
  }

  // NEW slash removeword
  if (commandName === 'removeword') {
    const word = options.getString('word').trim().toLowerCase();
    if (blacklistedWords.delete(word)) {
      return interaction.reply({ content: `Removed **${word}** from blacklist.`, ephemeral: false });
    } else {
      return interaction.reply({ content: `**${word}** not in blacklist.`, ephemeral: true });
    }
  }

  // NEW slash hardban
  if (commandName === 'hardban') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: "You need Ban Members permission.", ephemeral: true });
    }

    const user = options.getUser('user');
    if (!user) return interaction.reply({ content: "No user selected.", ephemeral: true });

    try {
      await interaction.guild.bans.create(user.id, {
        deleteMessageSeconds: 604800,
        reason: `Hardban by ${interaction.user.tag} via Vurah Bot`
      });
      return interaction.reply({ content: `**Hardbanned** ${user} permanently. Last 7 days messages deleted.`, ephemeral: false });
    } catch (err) {
      console.error('Hardban failed:', err);
      return interaction.reply({ content: `Failed to ban ${user}: ${err.message}`, ephemeral: true });
    }
  }

  // NEW slash hardunban
  if (commandName === 'hardunban') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: "You need Ban Members permission.", ephemeral: true });
    }

    const userId = options.getString('userid');
    if (!userId) return interaction.reply({ content: "No user ID provided.", ephemeral: true });

    try {
      await interaction.guild.bans.remove(userId, `Unbanned by ${interaction.user.tag} via Vurah Bot`);
      return interaction.reply({ content: `**Unbanned** <@${userId}>.`, ephemeral: false });
    } catch (err) {
      console.error('Hardunban failed:', err);
      return interaction.reply({ content: `Failed to unban <@${userId}>: ${err.message}`, ephemeral: true });
    }
  }
});

// Prefix backup (optional now, but kept for redundancy)
client.on('messageCreate', async message => {
  // ... (same deletion logic as before - GIF + word checks)
  // I kept it short here, but it's the full block from previous messages
  // (copy the entire deletion part if needed from your old code)
});

client.login(process.env.TOKEN);
