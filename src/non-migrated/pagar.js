import { SlashCommandBuilder } from "discord.js";
import { getOrCreateAccount } from "../handlers/accounts.js";
import {
  EphemeralMessageResponse,
  validateRelaysStatus,
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

// Called by the interactionCreate event listener when the corresponding command is invoked
const invoke = async (interaction) => {
  try {
    const user = interaction.user;
    if (!user) return;

    await interaction.deferReply({ ephemeral: true });
    await validateRelaysStatus();

    const paymentRequest = interaction.options.get(`bolt11`).value;

    log(`@${user.username} ejecutó /pagar ${paymentRequest}`, "info");

    const wallet = await getOrCreateAccount(user.id, user.username);

    wallet.payInvoice({
      paymentRequest,
      onSuccess: () => {
        log(`@${user.username} pago la factura ${paymentRequest}`, "info");

        interaction.editReply({
          content: `Pagaste la factura ${paymentRequest}`,
          ephemeral: true,
        });
      },
      onError: () => {
        log(
          `@${user.username} no pudo pagar la factura ${paymentRequest}`,
          "err"
        );

        EphemeralMessageResponse(interaction, "Ocurrió un error");
      },
    });
  } catch (err) {
    log(
      `Error en el comando /pagar ejecutado por @${interaction.user.username} - Código de error ${err.code} Mensaje: ${err.message}`,
      "err"
    );
    EphemeralMessageResponse(interaction, "Ocurrió un error");
  }
};

export { create, invoke };
