import { ActionRowBuilder, ButtonBuilder } from "discord.js";
import { getAndValidateAccount } from "../../handlers/accounts.js";
import { log } from "../../handlers/log.js";
import { FollowUpEphemeralResponse } from "../../utils/helperFunctions.js";

const customId = "pay";

const invoke = async (interaction) => {
  try {
    await interaction.deferReply({ ephemeral: true });

    const payUrl = interaction.message.embeds[0].fields.find(
      (field) => field.name === "Solicitud de pago"
    );

    const amountOnSats = interaction.message.embeds[0].fields.find(
      (field) => field.name === "monto (sats)"
    );

    if (payUrl) {
      const userWallet = await getAndValidateAccount(interaction, interaction.user.id);
      const satsBalance = userWallet.balance;

      if (satsBalance < amountOnSats.value) {
        return FollowUpEphemeralResponse(
          interaction,
          `No tienes balance suficiente para pagar esta factura. \nTu balance: ${satsBalance} - Requerido: ${amountOnSats.value}`
        );
      } else {
        const response = await userWallet.nwcClient.payInvoice({
          invoice: payUrl.value,
        });

        if (!response) throw new Error("Error al pagar la factura");

        const row = new ActionRowBuilder().addComponents([
          new ButtonBuilder()
            .setCustomId("pay")
            .setLabel(`Pagada por @${interaction.user.username}`)
            .setEmoji({ name: `💸` })
            .setStyle(2)
            .setDisabled(true),
        ]);

        interaction.message.edit({ components: [row] });

        return interaction.editReply({
          content: "Interacción con pago de factura completada.",
          ephemeral: true,
        });
      }
    }
  } catch (err) {
    log(
      `Error cuando @${interaction.user.username} intentó pagar una factura de /solicitar - Código de error ${err.code} Mensaje: ${err.message}`,
      "err"
    );
    return FollowUpEphemeralResponse(interaction, "Ocurrió un error");
  }
};

export { invoke, customId };
