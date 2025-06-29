
require('dotenv/config');
const { Client, IntentsBitField, SlashCommandBuilder, REST, Routes } = require('discord.js');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 5000;

// Uptime endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    bot_status: client.user ? 'Ready' : 'Not Ready',
    guilds: client.guilds ? client.guilds.cache.size : 0
  });
});

app.get('/ping', (req, res) => {
  res.json({ message: 'pong', timestamp: Date.now() });
});

app.get('/status', (req, res) => {
  res.json({
    bot_name: client.user ? client.user.tag : 'Not logged in',
    bot_id: client.user ? client.user.id : null,
    guilds_count: client.guilds ? client.guilds.cache.size : 0,
    uptime_seconds: process.uptime(),
    memory_usage: process.memoryUsage(),
    node_version: process.version
  });
});

// Start Express server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Uptime server running on port ${PORT}`);
});

const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

let chatChannelId = null;

client.on('ready', async () => {
  console.log('The bot is online!');
  
  // Register slash commands
  const commands = [
    new SlashCommandBuilder()
      .setName('set-chatgpt')
      .setDescription('Set the channel for ChatGPT responses')
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('The channel to set for ChatGPT')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('chatgpt-reset')
      .setDescription('Reset the ChatGPT channel to default'),
    new SlashCommandBuilder()
      .setName('botstats')
      .setDescription('Display comprehensive bot statistics'),
  ];

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'set-chatgpt') {
    const channel = interaction.options.getChannel('channel');
    chatChannelId = channel.id;
    
    await interaction.reply({
      content: `ChatGPT channel has been set to ${channel}`,
      flags: [64] // Ephemeral flag
    });
  }

  if (interaction.commandName === 'chatgpt-reset') {
    chatChannelId = null; // Reset to default channel
    
    await interaction.reply({
      content: `ChatGPT channel has been reset to default`,
      flags: [64] // Ephemeral flag
    });
  }

  if (interaction.commandName === 'botstats') {
    const os = require('os');
    
    // Calculate uptime
    const uptime = process.uptime() * 1000;
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
    const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
    
    // Memory usage
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    // Convert bytes to appropriate units
    const formatBytes = (bytes) => {
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      if (bytes === 0) return '0 Bytes';
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };
    
    // Discord stats
    const totalGuilds = client.guilds.cache.size;
    const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    const totalChannels = client.channels.cache.size;
    
    const statsEmbed = {
      title: '🤖 Bot Statistics',
      color: 0x0099ff,
      fields: [
        {
          name: '⏱️ Uptime',
          value: `\`${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds\``,
          inline: false
        },
        {
          name: '🔧 Node.js Version',
          value: `\`${process.version}\``,
          inline: true
        },
        {
          name: '📊 Discord Stats',
          value: `❒ Total guilds: ${totalGuilds}\n❒ Total users: ${totalUsers}\n❒ Total channels: ${totalChannels}\n❒ Websocket Ping: ${client.ws.ping} ms`,
          inline: false
        },
        {
          name: '💻 System Info',
          value: `❯ **OS:** ${os.type().toLowerCase()} [${os.arch()}]\n❯ **Cores:** ${os.cpus().length}\n❯ **Total Memory:** ${formatBytes(totalMem)}\n❯ **Used Memory:** ${formatBytes(usedMem)}\n❯ **Available Memory:** ${formatBytes(freeMem)}\n❯ **Memory Usage:** ${Math.round((usedMem / totalMem) * 100)}%`,
          inline: false
        },
        {
          name: '🔧 Process Memory',
          value: `❯ **RSS:** ${formatBytes(memUsage.rss)}\n❯ **Heap Used:** ${formatBytes(memUsage.heapUsed)}\n❯ **Heap Total:** ${formatBytes(memUsage.heapTotal)}`,
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Bot Statistics'
      }
    };
    
    await interaction.reply({
      embeds: [statsEmbed],
      flags: [64] // Ephemeral flag
    });
  }
});

async function callPollinationsAPI(messages) {
  try {
    // Convert conversation to a simple prompt format
    let prompt = messages.map(msg => {
      if (msg.role === 'system') return `System: ${msg.content}`;
      if (msg.role === 'user') return `User: ${msg.content}`;
      if (msg.role === 'assistant') return `Assistant: ${msg.content}`;
      return msg.content;
    }).join('\n');

    const response = await axios.post('https://text.pollinations.ai/', {
      messages: [{ role: 'user', content: prompt }],
      model: 'openai'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.log(`Pollinations API Error: ${error}`);
    throw error;
  }
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== chatChannelId) return;
  if (message.content.startsWith('!')) return;

  let conversationLog = [
    { role: 'system', content: 'You are a friendly chatbot.' },
  ];

  try {
    await message.channel.sendTyping();
    let prevMessages = await message.channel.messages.fetch({ limit: 15 });
    prevMessages.reverse();
    
    prevMessages.forEach((msg) => {
      if (msg.content.startsWith('!')) return;
      if (msg.author.id !== client.user.id && msg.author.bot) return;
      if (msg.author.id == client.user.id) {
        conversationLog.push({
          role: 'assistant',
          content: msg.content,
          name: msg.author.username
            .replace(/\s+/g, '_')
            .replace(/[^\w\s]/gi, ''),
        });
      }

      if (msg.author.id == message.author.id) {
        conversationLog.push({
          role: 'user',
          content: msg.content,
          name: message.author.username
            .replace(/\s+/g, '_')
            .replace(/[^\w\s]/gi, ''),
        });
      }
    });

    const result = await callPollinationsAPI(conversationLog);
    
    // Handle different response formats from Pollinations API
    let responseText = '';
    if (typeof result === 'string') {
      responseText = result;
    } else if (result.choices && result.choices[0] && result.choices[0].message) {
      responseText = result.choices[0].message.content;
    } else if (result.message) {
      responseText = result.message;
    } else {
      responseText = 'Sorry, I received an unexpected response format.';
    }

    // Truncate response if it's too long (Discord limit is 2000 characters)
    if (responseText.length > 2000) {
      responseText = responseText.substring(0, 1997) + '...';
    }

    message.reply(responseText);
  } catch (error) {
    console.log(`ERR: ${error}`);
    message.reply('Sorry, I encountered an error while processing your message.');
  }
});

client.login(TOKEN);
