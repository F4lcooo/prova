const {
  Client,
  EmbedBuilder,
  ActionRowBuilder,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.GuildMember,
  ],
});

// Host the bot:
require("http")
  .createServer((req, res) => res.end(""))
  .listen(3030);

client.once("ready", () => {
  console.log(client.user.username + " is ready!");
  console.log("== The logs are starting from here ==");
});

const config = require("./config.js");
const owner = config.modmail.ownerID;
const supportcat = config.modmail.supportId;
const premiumcat = config.modmail.premiumId;
const whitelistrole = config.modmail.whitelist;
const staffID = config.modmail.staff;
const log = config.logs.logschannel;
const cooldowns = new Map(); // Map to track cooldowns

client.on("messageCreate", async (message) => {
  if (message.author.id === owner) {
    if (message.content.toLowerCase().startsWith("!ticket-embed")) {
      message.delete();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("📨 Support")
          .setStyle(ButtonStyle.Secondary)
          .setCustomId("support"),
        new ButtonBuilder()
          .setLabel("💸 Premium")
          .setStyle(ButtonStyle.Secondary)
          .setCustomId("premium"),
      );

      const ticketmsg = new EmbedBuilder()
        .setTitle(`${message.guild.name}'s Ticket System`)
        .setDescription(
          `**Welcome to our Support Ticket System!** 🎫

*To ensure prompt assistance, please click on one of the buttons below to open a ticket in the category that best fits your inquiry. Our dedicated support team is ready to help you with any questions or issues you may encounter. Choose the appropriate category, and we'll get back to you as soon as possible.*

🚀 **General Inquiry:** For general questions or information.

🛠️ **Premium Support:** Inquire about one of our products or services.

*Thank you for reaching out to us! Your satisfaction is our priority.*`,
        )
        .setFooter({
          text: `${message.guild.name} | Made with ❤️ by sparks.js`,
          iconURL: message.guild.iconURL(),
        })
        .setColor("#842abe");

      message.channel.send({
        embeds: [ticketmsg],
        components: [row],
      });
    }
  }
});

// Funzione per trascrivere il contenuto del ticket in un file .txt
async function logTicketContentToFile(channel) {
  const logChannel = await client.channels.fetch(log);
  if (!logChannel) {
    console.error("Log channel not found!");
    return;
  }

  try {
    const messages = await channel.messages.fetch({ limit: 100 }); // Limita a 100 messaggi
    const logContent = messages
      .filter((msg) => {
        // Filtra i messaggi del bot (ignora quelli con l'ID o il nome del bot specifico)
        return !msg.author.bot && msg.author.username !== 'TLCRP - Ticket Bot';
      })
      .map((msg) => {
        const date = msg.createdAt
          .toLocaleString('it-IT', { hour12: false }) // Formatta la data come "gg/mm/aaaa - hh:mm:ss"
          .replace(',', ''); // Rimuove la virgola tra la data e l'ora
        return `[${date}] ${msg.author.username}: ${msg.content}`;
      })
      .join("\n");

    // Se non ci sono messaggi da registrare, non fare nulla
    if (!logContent) {
      console.log("No user messages to log.");
      return;
    }

    // Definisci il nome del file di log
    const logFileName = `ticket_${channel.id}_logs.txt`;
    const logPath = path.join(__dirname, "ticketLogs", logFileName);

    // Crea la cartella 'ticketLogs' se non esiste
    if (!fs.existsSync(path.dirname(logPath))) {
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      console.log("Directory 'ticketLogs' created.");
    }

    // Scrivi il contenuto nel file di log
    fs.writeFileSync(logPath, logContent, "utf8");

    // Invia il file nel canale di log
    await logChannel.send({
      content: `Ticket logs for <#${channel.id}>:`,
      files: [logPath],
    });

    // Elimina il file dopo averlo inviato
    fs.unlinkSync(logPath);
  } catch (error) {
    console.error("Error while logging ticket content:", error);
  }
}

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isButton()) {
      const userId = interaction.user.id;
      const userCooldown = cooldowns.get(userId) || 0;
      const currentTime = Date.now();

      if (
        userCooldown > currentTime &&
        (interaction.customId === "support" ||
          interaction.customId === "premium")
      ) {
        const remainingTime = Math.ceil((userCooldown - currentTime) / 1000);
        interaction.reply({
          content: `You're on a cooldown. Please wait ${remainingTime} seconds before opening another ticket.`,
          ephemeral: true,
        });
        return;
      }

      let ticket;

      if (
        interaction.customId === "support" ||
        interaction.customId === "premium"
      ) {
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("⚙️ Manage")
            .setCustomId("close")
            .setStyle(ButtonStyle.Primary),
        );

        const supportmsg = new EmbedBuilder()
          .setTitle(`${interaction.user.displayName}'s Support Ticket`)
          .setDescription(
            "**Hello!**\nPlease provide a detailed description of your query, and one of our team members will assist you shortly.",
          )
          .setFooter({ text: `User ID: ${interaction.user.id}` })
          .setColor("#2a043b");

        const premiummsg = new EmbedBuilder()
          .setTitle(`${interaction.user.displayName}'s Premium Ticket`)
          .setDescription(
            "**Hello there!**\nNeed assistance with our premium features? Feel free to share details about your inquiry, and our team will get back to you shortly. Your satisfaction is our priority!",
          )
          .setFooter({ text: `User ID: ${interaction.user.id}` })
          .setColor("#2a043b");

        if (interaction.customId === "support") {
          ticket = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: supportcat,
            permissionOverwrites: [
              {
                id: interaction.user.id,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                ],
              },
              {
                id: whitelistrole,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                ],
              },
              {
                id: interaction.guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel],
              },
            ],
          });

          interaction.reply({
            content: `<#${ticket.id}> has been created under the General Support Category.`,
            ephemeral: true,
          });

          client.channels.cache
            .get(log)
            .send(
              `# New Ticket\n\n**User:** <@${interaction.user.id}> opened <#${ticket.id}> under General Support Category!`,
            );
          ticket.send({
            content: `<@&${staffID}>\n**==========================**`,
            embeds: [supportmsg],
            components: [row2],
          });
        }

        if (interaction.customId === "premium") {
          ticket = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: premiumcat,
            permissionOverwrites: [
              {
                id: interaction.user.id,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                ],
              },
              {
                id: whitelistrole,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                ],
              },
              {
                id: interaction.guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel],
              },
            ],
          });

          interaction.reply({
            content: `<#${ticket.id}> has been created under the Premium Support Category.`,
            ephemeral: true,
          });

          client.channels.cache
            .get(log)
            .send(
              `# New Ticket\n\n**User:** <@${interaction.user.id}> opened <#${ticket.id}> under Premium Support Category!`,
            );
          ticket.send({
            content: `<@&${staffID}>\n**==========================**`,
            embeds: [premiummsg],
            components: [row2],
          });
        }

        // Set cooldown for the user (2 hours in milliseconds)
        cooldowns.set(userId, currentTime + 2 * 60 * 60 * 1000);
      } else if (interaction.customId === "close") {
        // Check if the user has the whitelisted role
        const guild = interaction.guild;
        const member = guild.members.cache.get(userId);

        if (!member.roles.cache.has(whitelistrole)) {
          interaction.reply({
            content: "You are not whitelisted to perform this action.",
            ephemeral: true,
          });
          return;
        }

        const deleteButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("🗑️ Delete")
            .setCustomId("delete")
            .setStyle(ButtonStyle.Danger),
        );

        const close2Button = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("🔒 Close")
            .setCustomId("close2")
            .setStyle(ButtonStyle.Primary),
        );

        interaction.update({
          content: `<@${interaction.user.id}> **Please click on either of the following button.**`,
          components: [deleteButton, close2Button],
        });
      } else if (interaction.customId === "delete") {
        // Trascrivi i messaggi nei log prima di eliminare il ticket
        const channel = interaction.channel;
        if (channel) {
          await logTicketContentToFile(channel); // Trascrizione dei messaggi

          // Elimina il canale del ticket
          try {
            await channel.delete();
            const logChannel = client.channels.cache.get(log);
            if (logChannel) {
              logChannel.send(
                `# Ticket Deleted\n\n**User:** <@${interaction.user.id}> deleted a ticket.`,
              );
            }
          } catch (err) {
            console.error("Failed to delete the ticket channel:", err);
            interaction.reply(
              "Failed to delete the ticket channel. It might have already been deleted.",
            );
          }
        } else {
          console.error(
            "The ticket channel no longer exists or has already been deleted.",
          );
        }
      } else if (interaction.customId === "close2") {
        try {
          const channel = interaction.channel;
          if (channel && !channel.deleted) {
            await channel.permissionOverwrites.set([
              {
                id: interaction.guild.id,
                deny: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                ],
              },
            ]);

            await interaction.reply(
              `<@${interaction.user.id}> closed the ticket.`,
            );

            const logChannel = client.channels.cache.get(log);
            if (logChannel) {
              await logChannel.send(
                `# Ticket Closed\n\n**User:** <@${interaction.user.id}> closed a ticket.`,
              );
            }
          }
        } catch (error) {
          console.error(
            "An error occurred while processing the close2 interaction:",
            error,
          );
          interaction.reply({
            content: "An error occurred while processing your request.",
            ephemeral: true,
          });
        }
      }
    }
  } catch (e) {
    console.log(e);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  if (message.content.toLowerCase() === `!setup`) {
    // Create General Tickets category
    const generalTicketsCategory = await message.guild.channels.create({
      name: "General Tickets",
      type: ChannelType.GuildCategory,
    });

    // Create Premium Tickets category
    const premiumTicketsCategory = await message.guild.channels.create({
      name: "Premium Tickets",
      type: ChannelType.GuildCategory,
    });

    // Create Ticket Logs category
    const ticketLogsCategory = await message.guild.channels.create({
      name: "Logs",
      type: ChannelType.GuildCategory,
    });

    // Create a channel inside Ticket Logs category named 'ticket-logs'
    const ticket = await message.guild.channels.create({
      name: `ticket logs`,
      type: ChannelType.GuildText,
      parent: ticketLogsCategory,
      permissionOverwrites: [
        {
          id: message.author.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
          ],
        },
        {
          id: whitelistrole,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
          ],
        },
        {
          id: message.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
      ],
    });

    // Reply to the user in the channel where the command was received
    message.channel.send("Ticket setup completed!");
  }
});

// Log in to Discord using your token
client.login(process.env.TOKEN);
