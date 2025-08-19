import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getOrCreateAccount } from "../handlers/accounts.js";
import {
  EphemeralMessageResponse,
  FollowUpEphemeralResponse,
  validateAmountAndBalance,
  validateRelaysStatus,
} from "../utils/helperFunctions.js";
import { updateUserRank } from "../handlers/donate.js";
import lnurl from "lnurl-pay";
import { formatter } from "../utils/helperFormatter.js";
import { log } from "../handlers/log.js";

// Creates an object with the data required by Discord's API to create a SlashCommand
const create = () => {
  const command = new SlashCommandBuilder()
    .setName("donar")
    .setDescription("Realiza donaciones al pozo de la crypta.")
    .addNumberOption((opt) =>
      opt
        .setName("monto")
        .setDescription("La cantidad de satoshis a donar")
        .setRequired(true)
    );

  return command.toJSON();
};

// Called by the interactionCreate event listener when the corresponding command is invoked
const invoke = async (interaction) => {
  try {
    const user = interaction.user;
    if (!user) return;

    await interaction.deferReply();
    await validateRelaysStatus();

    const amount = parseInt(interaction.options.get(`monto`).value);

    log(`@${user.username} ejecutó /donar ${amount}`, "info");

    const wallet = await getOrCreateAccount(user.id, user.username);
    const senderBalance = await wallet.getBalance("BTC");

    const isValidAmount = validateAmountAndBalance(
      amount,
      senderBalance / 1000
    );

    if (!isValidAmount.status)
      return FollowUpEphemeralResponse(interaction, isValidAmount.content);

    const invoice = await lnurl.requestInvoice({
      lnUrlOrAddress: process.env.POOL_ADDRESS,
      tokens: amount,
    });

    if (invoice && invoice.invoice) {
      await wallet.payInvoice({
        paymentRequest: invoice.invoice,
        onSuccess: async () => {
          const updatedRank = await updateUserRank(
            interaction.user.id,
            "pozo",
            amount
          );

          const embed = new EmbedBuilder()
            .setColor(`#0099ff`)
            .setAuthor({
              name: `${interaction.user.globalName}`,
              iconURL: `https://cdn.discordapp.com/avatars/${interaction.user.id}/${interaction.user.avatar}`,
            })
            .addFields(
              {
                name: `Donación a ${process.env.POOL_ADDRESS}`,
                value: `${interaction.user.toString()} ha donado ${formatter(
                  0,
                  2
                ).format(amount)} satoshis al pozo!`,
              },
              {
                name: "Total donado",
                value:
                  updatedRank && updatedRank.amount
                    ? `${formatter(0, 0).format(updatedRank.amount)}`
                    : "0",
              }
            );

          log(`@${user.username} donó ${amount} al pozo`, "info");

          return interaction.editReply({ embeds: [embed] });
        },
        onError: () => {
          log(
            `@${user.username} no pudo realizar el pago de /donar ${amount}`,
            "err"
          );

          EphemeralMessageResponse(
            interaction,
            "Ocurrió un error al realizar el pago."
          );
        },
      });
    }
  } catch (err) {
    log(
      `Error en el comando /donar ejecutado por @${interaction.user.username} - Código de error ${err.code} Mensaje: ${err.message}`,
      "err"
    );

    EphemeralMessageResponse(interaction, "Ocurrió un error");
  }
};

export { create, invoke };
