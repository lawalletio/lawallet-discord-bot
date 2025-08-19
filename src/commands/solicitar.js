import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { getAndValidateAccount } from "../handlers/accounts.js";
import {
  EphemeralMessageResponse,
} from "../utils/helperFunctions.js";
import { AuthorConfig } from "../utils/helperConfig.js";
import { formatter } from "../utils/helperFormatter.js";
import { log } from "../handlers/log.js";

// Creates an object with the data required by Discord's API to create a SlashCommand
const create = () => {
  const command = new SlashCommandBuilder()
    .setName("solicitar")
    .setDescription("Solicitar que te paguen una factura")
    .addNumberOption((opt) =>
      opt
        .setName("monto")
        .setDescription("La cantidad de satoshis a pagar en la factura")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("descripcion")
        .setDescription("La descripción de la factura")
        .setRequired(false)
    );

  return command.toJSON();
};

// Called by the interactionCreate event listener when the corresponding command is invoked
const invoke = async (interaction) => {
  try {
    const user = interaction.user;
    if (!user) return;

    await interaction.deferReply();

    const amount = parseInt(interaction.options.get(`monto`).value);
    const description = interaction.options.get(`descripcion`);

    log(`@${user.username} ejecutó el comando /solicitar ${amount}`, "info");

    if (amount <= 0)
      return FollowUpEphemeralResponse(
        interaction,
        "No se permiten saldos negativos"
      );

    const wallet = await getAndValidateAccount(interaction, user.id);

    const invoiceDetails = await wallet.nwcClient.makeInvoice({
      amount: amount * 1000,
      description: description ? description.value : "",
    });

    const embed = new EmbedBuilder().setAuthor(AuthorConfig).addFields([
      {
        name: `Solicitud de pago`,
        value: `${invoiceDetails.invoice}`,
      },
      {
        name: `monto (sats)`,
        value: `${formatter(0, 0).format(amount)}`,
      },
    ]);

    const row = new ActionRowBuilder().addComponents([
      new ButtonBuilder()
        .setCustomId("pay")
        .setLabel("Pagar factura")
        .setEmoji({ name: `💸` })
        .setStyle(2),
    ]);

    interaction.editReply({
      embeds: [embed],
      components: [row],
    });
  } catch (err) {
    log(
      `Error en el comando /solicitar ejecutado por @${interaction.user.username} - Código de error ${err.code} Mensaje: ${err.message}`,
      "err"
    );
    EphemeralMessageResponse(interaction, "Ocurrió un error");
  }
};

export { create, invoke };
