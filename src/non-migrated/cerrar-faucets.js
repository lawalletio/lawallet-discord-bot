import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { getOrCreateAccount } from "../handlers/accounts.js";
import { closeFaucet, getAllOpenFaucets } from "../handlers/faucet.js";
import { AuthorConfig } from "../utils/helperConfig.js";
import {
  EphemeralMessageResponse,
  validateRelaysStatus,
} from "../utils/helperFunctions.js";
import { log } from "../handlers/log.js";

// Creates an object with the data required by Discord's API to create a SlashCommand
const create = () => {
  const command = new SlashCommandBuilder()
    .setName("cerrar-faucets")
    .setDescription(
      "Cierra todos los faucets abiertos en tu nombre y reintegra los fondos sobrantes a tu cuenta"
    );

  return command.toJSON();
};

// Called by the interactionCreate event listener when the corresponding command is invoked
const invoke = async (interaction) => {
  try {
    const user = interaction.user;
    if (!user) return;

    await interaction.deferReply({ ephemeral: true });
    await validateRelaysStatus();

    log(`@${user.username} ejecutó /cerrar-faucets`, "info");

    const faucets = await getAllOpenFaucets(user.id);

    if (!faucets.length) {
      EphemeralMessageResponse(
        interaction,
        "No se encontró ningún faucet abierto asociado a tu usuario"
      );
    } else {
      let msgOutput = ``;

      await Promise.all(
        faucets.map(async (faucet) => {
          try {
            let faucetId = faucet._id.toString();
            let remainingClaims = faucet.maxUses - faucet.claimersIds.length;
            if (!remainingClaims) {
              await closeFaucet(faucetId);
              return;
            }

            // if (closedFaucet && closedFaucet.closed) {
            const wallet = await getOrCreateAccount(user.id, user.username);
            const faucetWallet = await getOrCreateAccount(
              faucetId,
              "faucet-account"
            );

            let milisatoshis = await faucetWallet.getBalance("BTC");
            if (!milisatoshis || milisatoshis < 1000) {
              await closeFaucet(faucetId);
              return;
            }

            const invoiceDetails = await wallet.generateInvoice({
              milisatoshis,
            });

            if (!invoiceDetails || !invoiceDetails.pr) return;

            let closedFaucet = await closeFaucet(faucetId);
            if (closedFaucet && closedFaucet.closed) {
              try {
                if (closedFaucet.channelId && closedFaucet.messageId) {
                  const channel = await interaction.guild.channels.fetch(
                    closedFaucet.channelId
                  );

                  if (channel) {
                    const message = await channel.messages.fetch(
                      closedFaucet.messageId
                    );

                    if (message) {
                      const fieldsInfo = message.embeds[0].fields;

                      const embed = new EmbedBuilder()
                        .setAuthor(AuthorConfig)
                        .addFields(fieldsInfo)
                        .setFooter({
                          text: `Identificador: ${faucetId}`,
                        });

                      const row = new ActionRowBuilder().addComponents([
                        new ButtonBuilder()
                          .setCustomId("closefaucet")
                          .setLabel("El faucet ha sido cerrado por su autor")
                          .setEmoji({ name: `✖️` })
                          .setStyle(2)
                          .setDisabled(true),
                      ]);

                      await message.edit({
                        embeds: [embed],
                        components: [row],
                      });
                    }
                  }
                }
              } catch (err) {
                console.log(err);
              }
            }

            await faucetWallet.payInvoice({
              paymentRequest: invoiceDetails.pr,
              onSuccess: async () => {
                log(
                  `@${
                    user.username
                  } ejecutó /cerrar-faucets: cerró el faucet ${faucetId} y se le reintegraron ${
                    milisatoshis / 1000
                  } sats`,
                  "info"
                );

                msgOutput += `Faucet ${faucetId} fue cerrado y retornaron ${
                  milisatoshis / 1000
                } sats a tu cuenta.\n`;
              },
              onError: async () => {
                log(
                  `@${
                    user.username
                  } ejecutó /cerrar-faucets: cerró el faucet ${faucetId} pero ocurrió un error al reintegrar ${
                    milisatoshis / 1000
                  } sats`,
                  "err"
                );

                msgOutput += `Faucet ${faucetId} fue cerrado pero ocurrió un error al reintegrar los fondos (${
                  milisatoshis / 1000
                } sats).\n`;
              },
            });
          } catch (err) {
            console.log(err);
            return;
          }
        })
      );

      const embed = new EmbedBuilder()
        .setColor(`#0099ff`)
        .setAuthor(AuthorConfig)
        .addFields({
          name: `Comando ejecutado exitosamente`,
          value: msgOutput.length
            ? msgOutput
            : "Se cerraron todos los faucets abiertos, no había fondos para retornar.",
        });

      log(`@${user.username} cerró todos sus faucets`, "info");
      interaction.editReply({ embeds: [embed], ephemeral: true });
    }
  } catch (err) {
    log(
      `Error en el comando /cerrar-faucets ejecutado por @${interaction.user.username} - Código de error ${err.code} Mensaje: ${err.message}`,
      "err"
    );
    EphemeralMessageResponse(interaction, "Ocurrió un error");
  }
};

export { create, invoke };
