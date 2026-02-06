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
const PREFIX = '!!';

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
const blacklistedWords = new Set();          // triggers deletion
const whitelistedExceptions = new Set();     // keeps message even if bad word present (unused for now)

// Allowed roles that bypass everything (from .env)
const allowedRoleNames = (process.env.ALLOWED_ROLES || 'Admin,Moderator').split(',').map(r => r.trim().toLowerCase());

// NEW: Specific role name that bypasses automod (GIF + word checks)
const AUTOMOD_BYPASS_ROLE = 'automod bypass';  // case-insensitive

client.once('ready', async () => {
  console.log(`Vurah Bot online! Prefix: ${PREFIX} | Tag: ${client.user.tag}`);

  const commands = [
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
    new SlashCommandBuilder()
      .setName('setupautomod')
      .setDescription('View automod word lists and how to manage them')
  ];

  await client.application.commands.set(commands);
  console.log('Slash commands registered');
});

function canManage(member) {
  return member.permissions.has(PermissionsBitField.Flags.ManageMessages);
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
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
        `**Manage with prefix ,**`
      )
      .addFields(
        { name: `,addword <word>`, value: `Add to blacklist`, inline: true },
        { name: `,removeword <word>`, value: `Remove from blacklist`, inline: true },
        { name: `,setup automod`, value: `Show this`, inline: true }
      )
      .setFooter({ text: 'Vurah Bot' });

    return interaction.reply({ embeds: [embed], ephemeral: false });
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const member = message.member;

  // Bypass checks (order: admin > allowed roles > automod bypass role)
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

  const hasAllowedRole = member.roles.cache.some(role => allowedRoleNames.includes(role.name.toLowerCase()));
  if (hasAllowedRole) return;

  // NEW: Automod Bypass role check
  const hasAutomodBypass = member.roles.cache.some(role => role.name.toLowerCase() === AUTOMOD_BYPASS_ROLE);
  if (hasAutomodBypass) return;

  const content = message.content.trim();
  const lowerContent = content.toLowerCase();

  // Prefix commands (only mods can use)
  if (content.startsWith(PREFIX)) {
    if (!canManage(member)) {
      return message.reply("Mods only for setup.").catch(() => {});
    }

    const args = content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();
    let reply = '';

    if (command === 'setup' && args[0]?.toLowerCase() === 'automod') {
      // same embed as slash
      const badList = blacklistedWords.size ? Array.from(blacklistedWords).map(w => `- ${w}`).join('\n') : 'None yet';
      const goodList = whitelistedExceptions.size ? Array.from(whitelistedExceptions).map(w => `- ${w}`).join('\n') : 'None';
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('Automod Setup')
        .setDescription(
          `**Blacklisted words** (triggers deletion):\n${badList}\n\n` +
          `**Exceptions** (safe even with blacklisted words):\n${goodList}\n\n` +
          `**Commands:**`
        )
        .addFields(
          { name: `${PREFIX}addword <word>`, value: `Add to blacklist`, inline: true },
          { name: `${PREFIX}removeword <word>`, value: `Remove from blacklist`, inline: true },
          { name: `${PREFIX}setup automod`, value: `Show this`, inline: true }
        )
        .setFooter({ text: 'Vurah Bot' });

      return message.channel.send({ embeds: [embed] }).catch(() => {});
    }

    else if (command === 'addword') {
      const word = args.join(' ').trim().toLowerCase();
      if (!word) return message.reply(`Usage: ${PREFIX}addword <word or phrase>`).catch(() => {});
      blacklistedWords.add(word);
      reply = `Added **${word}** to blacklist.`;
    }

    else if (command === 'removeword') {
      const word = args.join(' ').trim().toLowerCase();
      if (!word) return message.reply(`Usage: ${PREFIX}removeword <word>`).catch(() => {});
      if (blacklistedWords.delete(word)) {
        reply = `Removed **${word}** from blacklist.`;
      } else {
        reply = `**${word}** not in blacklist.`;
      }
    }

    if (reply) {
      return message.channel.send(reply).catch(() => {});
    }

    return;
  }

  // Deletion logic (GIF + words) - only reaches here if no bypass
  let shouldDelete = false;
  let reason = '';
  let detected = '';

  // GIF checks
  let detectedURL = '';
  for (const att of message.attachments.values()) {
    const url = att.url.toLowerCase();
    if (url.endsWith('.gif') || url.includes('.gif?') || (url.endsWith('.webp') && url.includes('animation'))) {
      detectedURL = att.url;
      shouldDelete = true;
      reason = 'Uploaded GIF';
      break;
    }
  }

  if (!shouldDelete && GIF_PATTERNS.some(p => lowerContent.includes(p))) {
    detectedURL = content.split(/\s+/).find(w => GIF_PATTERNS.some(p => w.toLowerCase().includes(p))) || content;
    shouldDelete = true;
    reason = 'GIF link';
  }

  if (!shouldDelete) {
    for (const embed of message.embeds) {
      const eUrl = (embed.url || embed.image?.url || embed.video?.url || '').toLowerCase();
      const prov = (embed.provider?.name || '').toLowerCase();
      if (eUrl.includes('tenor') || eUrl.includes('giphy') || prov.includes('tenor') || prov.includes('giphy') || eUrl.endsWith('.gif')) {
        detectedURL = embed.url || 'embedded GIF';
        shouldDelete = true;
        reason = 'Embedded GIF';
        break;
      }
    }
  }

  if (shouldDelete && detectedURL && whitelistedGIFs.has(detectedURL.trim())) {
    shouldDelete = false;
  }

  // Word check
  if (!shouldDelete) {
    for (const bad of blacklistedWords) {
      if (lowerContent.includes(bad)) {
        shouldDelete = true;
        reason = 'Blacklisted word';
        detected = bad;

        // Optional exception check
        let hasException = false;
        for (const good of whitelistedExceptions) {
          if (lowerContent.includes(good)) {
            hasException = true;
            break;
          }
        }
        if (hasException) shouldDelete = false;

        if (!shouldDelete) break;
        break;
      }
    }
  }

  if (shouldDelete) {
    try {
      await message.delete();
      const embed = new EmbedBuilder()
        .setColor('#FF5555')
        .setTitle('Message Removed')
        .setDescription(`Reason: ${reason}${detected ? ` (${detected})` : ''}`)
        .setFooter({ text: 'Vurah Bot' });

      await message.channel.send({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }
});

client.login(process.env.TOKEN);
