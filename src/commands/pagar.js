import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getAndValidateAccount } from "../handlers/accounts.js";
import {
  EphemeralMessageResponse,
  validateAndDecodeBOLT11,
  validateAmountAndBalance,
  isBOLT11Expired
} from "../utils/helperFunctions.js";
import { log } from "../handlers/log.js";

// Creates an object with the data required by Discord's API to create a SlashCommand
const create = () => {
  const command = new SlashCommandBuilder()
    .setName("pagar")
    .setDescription("Paga una factura de lightning network")
    .addStringOption((opt) =>
      opt
        .setName("bolt11")
        .setDescription("BOLT11 de la factura que quieres pagar")
        .setRequired(true)
    );

  return command.toJSON();
};

const invoke = async (interaction) => {
  try {
    const user = interaction.user;
    if (!user) return;

    await interaction.deferReply({ ephemeral: true });

    const paymentRequest = interaction.options.get(`bolt11`).value;

    log(`@${user.username} ejecutó /pagar ${paymentRequest}`, "info");

    const bolt11Validation = validateAndDecodeBOLT11(paymentRequest);
    if (!bolt11Validation.valid) {
      log(`@${user.username} - BOLT11 inválido: ${bolt11Validation.error}`, "err");
      await EphemeralMessageResponse(interaction, `❌ **Error en BOLT11:** ${bolt11Validation.error}`);
      return;
    }

    const { amount, description, decoded } = bolt11Validation;

    if (isBOLT11Expired(decoded)) {
      log(`@${user.username} - BOLT11 expirado`, "err");
      await EphemeralMessageResponse(interaction, "❌ **La factura ha expirado.**");
      return;
    }

    const accountResult = await getAndValidateAccount(interaction, user.id);
    if (!accountResult.success) {
      await EphemeralMessageResponse(interaction, accountResult.message);
      return;
    }

    const { nwcClient, balance } = accountResult;

    const balanceValidation = validateAmountAndBalance(amount, balance);
    if (!balanceValidation.status) {
      log(`@${user.username} - Saldo insuficiente: ${balanceValidation.content}`, "err");
      await EphemeralMessageResponse(interaction, balanceValidation.content);
      return;
    }

    try {
      const response = await nwcClient.payInvoice({
        invoice: paymentRequest,
      });

      log(`@${user.username} pagó exitosamente: ${JSON.stringify(response, null, 2)}`, "info");

      const successEmbed = new EmbedBuilder()
        .setAuthor({
          name: `Pago exitoso`,
          iconURL: `https://cdn.discordapp.com/avatars/${interaction.user.id}/${interaction.user.avatar}`,
        })
        .addFields([
          {
            name: 'Estado',
            value: 'Pago realizado correctamente',
          },
          {
            name: 'Monto pagado',
            value: `**${amount} satoshis**`,
          }
        ]);

      await interaction.editReply({
        content: null,
        embeds: [successEmbed],
      });

    } catch (paymentError) {
      log(`@${user.username} - Error al pagar: ${paymentError.message}`, "err");
      await EphemeralMessageResponse(interaction, `❌ **Error al realizar el pago:** ${paymentError.message}`);
    }

  } catch (err) {
    log(
      `Error en el comando /pagar ejecutado por @${interaction.user.username} - Código de error ${err.code} Mensaje: ${err.message}`,
      "err"
    );
    
    await EphemeralMessageResponse(interaction, "❌ Ocurrió un error inesperado");
  }
};

export { create, invoke };
