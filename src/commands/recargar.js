import {
  AttachmentBuilder,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { getAndValidateAccount } from "../handlers/accounts.js";
import {
  EphemeralMessageResponse,
  validateRelaysStatus,
} from "../utils/helperFunctions.js";
import QRCode from "qrcode";
import { log } from "../handlers/log.js";

// Creates an object with the data required by Discord's API to create a SlashCommand
const create = () => {
  const command = new SlashCommandBuilder()
    .setName("recargar")
    .setDescription("Recarga tu cuenta de lightning network con una factura")
    .addNumberOption((opt) =>
      opt
        .setName("monto")
        .setDescription("La cantidad de satoshis a pagar en la factura")
        .setRequired(true)
    );

  return command.toJSON();
};

// Called by the interactionCreate event listener when the corresponding command is invoked
const invoke = async (interaction) => {
  try {
    const user = interaction.user;
    if (!user) return;

    await interaction.deferReply({ ephemeral: true });

    const amount = parseInt(interaction.options.get(`monto`).value);

    log(`@${user.username} ejecutó /recargar ${amount}`, "info");

    if (amount <= 0)
      return EphemeralMessageResponse(
        interaction,
        "No se permiten saldos negativos"
      );

    const wallet = await getAndValidateAccount(interaction, user.id);
    const invoiceDetails = await wallet.nwcClient.makeInvoice({ amount: amount * 1000, description: `Recargar ${amount} sats a la billetera de discord del usuario ${interaction.user.username}` });

    const qrData = await QRCode.toDataURL(invoiceDetails.invoice);
    const buffer = new Buffer.from(qrData.split(`,`)[1], `base64`);
    const file = new AttachmentBuilder(buffer, `image.png`);
    const embed = new EmbedBuilder()
      .setImage(`attachment://image.png`)
      .addFields([
        {
          name: `Solicitud de pago`,
          value: `${invoiceDetails.invoice}`,
        },
        {
          name: "monto",
          value: `${amount}`,
        },
      ]);

    log(
      `@${user.username} ejecutó /recargar ${amount} y se le creo un invoice: ${invoiceDetails.invoice}`,
      "info"
    );

    return interaction.editReply({
      embeds: [embed],
      files: [file],
      ephemeral: true,
    });
  } catch (err) {
    log(
      `Error en el comando /recargar ejecutado por @${interaction.user.username} - Código de error ${err.code} Mensaje: ${err.message}`,
      "err"
    );
    EphemeralMessageResponse(interaction, "Ocurrió un error");
  }
};

export { create, invoke };
