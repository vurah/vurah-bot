require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, PermissionsBitField } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Whitelisted exact GIF URLs (safe forever) - add more with /allowgif
const whitelistedGIFs = new Set();

// You can pre-add some safe ones here if you want (optional)
// whitelistedGIFs.add('https://tenor.com/view/cute-cat-example-123456');

const GIF_PATTERNS = [
  '.gif',
  'tenor.com',
  'giphy.com',
  'gfycat.com',
  '.webp?width='
];

const allowedRoleNames = (process.env.ALLOWED_ROLES || 'Admin,Moderator').split(',').map(r => r.trim().toLowerCase());

client.once('ready', async () => {
  console.log(`GifPoliceBot online and watching! 👮‍♂️🗑️ Tag: ${client.user.tag}`);

  // Register slash commands (only needs to run once-ish)
  const commands = [
    new SlashCommandBuilder()
      .setName('allowgif')
      .setDescription('Whitelist a specific GIF link (it will never be deleted)')
      .addStringOption(option =>
        option.setName('url')
          .setDescription('Exact full link to allow (e.g. https://tenor.com/view/...)')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('blockgif')
      .setDescription('Force-block a specific GIF link')
      .addStringOption(option =>
        option.setName('url')
          .setDescription('Exact full link to block')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('listgifs')
      .setDescription('Show all whitelisted GIF links')
  ];

  await client.application.commands.set(commands);
  console.log('Slash commands are ready!');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // Only mods/admins can use these commands
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    return interaction.reply({ content: "Only people with Manage Messages can control me! 🚔", ephemeral: true });
  }

  if (interaction.commandName === 'allowgif') {
    const url = interaction.options.getString('url').trim();
    whitelistedGIFs.add(url);
    await interaction.reply({ content: `✅ **${url}** is now forever safe from deletion! 🐱💚`, ephemeral: false });
  }

  if (interaction.commandName === 'blockgif') {
    const url = interaction.options.getString('url').trim();
    whitelistedGIFs.delete(url); // remove from safe list
    await interaction.reply({ content: `⛔ **${url}** will now be deleted on sight! 🗑️`, ephemeral: false });
  }

  if (interaction.commandName === 'listgifs') {
    if (whitelistedGIFs.size === 0) {
      return interaction.reply({ content: "No safe GIFs yet! Use /allowgif to add some ✨", ephemeral: true });
    }
    const list = Array.from(whitelistedGIFs).map(u => `- ${u}`).join('\n');
    await interaction.reply({ content: `**Safe GIF links:**\n${list}`, ephemeral: true });
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

  const hasAllowedRole = message.member.roles.cache.some(role =>
    allowedRoleNames.includes(role.name.toLowerCase())
  );
  if (hasAllowedRole) return;

  let shouldDelete = false;
  let reason = '';
  let detectedURL = '';

  // Check uploaded files
  for (const att of message.attachments.values()) {
    const url = att.url.toLowerCase();
    if (url.endsWith('.gif') || url.includes('.gif?') || (url.endsWith('.webp') && url.includes('animation'))) {
      detectedURL = att.url;
      shouldDelete = true;
      reason = 'Uploaded GIF / animated file';
      break;
    }
  }

  // Check text links
  const contentLower = message.content.toLowerCase();
  if (!shouldDelete && GIF_PATTERNS.some(p => contentLower.includes(p))) {
    const words = message.content.split(/\s+/);
    detectedURL = words.find(w => GIF_PATTERNS.some(p => w.toLowerCase().includes(p))) || message.content;
    shouldDelete = true;
    reason = 'GIF link in message';
  }

  // Check embeds (Tenor/Giphy previews)
  if (!shouldDelete) {
    for (const embed of message.embeds) {
      const embedUrl = (embed.url || embed.image?.url || embed.video?.url || '').toLowerCase();
      const provider = (embed.provider?.name || '').toLowerCase();

      if (embedUrl.includes('tenor') || embedUrl.includes('giphy') || provider.includes('tenor') || provider.includes('giphy') || embedUrl.endsWith('.gif')) {
        detectedURL = embed.url || 'embedded GIF';
        shouldDelete = true;
        reason = 'Embedded GIF (Tenor/Giphy)';
        break;
      }
    }
  }

  // SAVE if it's in the safe list!
  if (shouldDelete && detectedURL && whitelistedGIFs.has(detectedURL.trim())) {
    shouldDelete = false;
    console.log(`Kept whitelisted GIF: ${detectedURL}`);
  }

  if (shouldDelete) {
    try {
      await message.delete();
      const replyEmbed = new EmbedBuilder()
        .setColor('#FF5555')
        .setTitle('🛑 No GIFs Allowed!')
        .setDescription(`${message.author}, GIFs are restricted here!\nReason: ${reason}\n\nMods can whitelist special ones with /allowgif 💜`)
        .setFooter({ text: 'GifPoliceBot' });

      await message.channel.send({ embeds: [replyEmbed] }).catch(() => {});
    } catch (err) {
      console.error('Could not delete:', err);
    }
  }
});

client.login(process.env.TOKEN);
