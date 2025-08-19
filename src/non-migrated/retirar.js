import { SlashCommandBuilder } from "discord.js";
import { getOrCreateAccount } from "../handlers/accounts.js";
import {
  EphemeralMessageResponse,
  validateAmountAndBalance,
  validateRelaysStatus,
} from "../utils/helperFunctions.js";
import lnurl from "lnurl-pay";
import { log } from "../handlers/log.js";

// Creates an object with the data required by Discord's API to create a SlashCommand
const create = () => {
  const command = new SlashCommandBuilder()
    .setName("retirar")
    .setDescription("Retira satoshis a una cuenta externa a discord")
    .addStringOption((opt) =>
      opt
        .setName("address")
        .setDescription("dirección de lightning network")
        .setRequired(true)
    )
    .addNumberOption((opt) =>
      opt
        .setName("monto")
        .setDescription("El monto en satoshis que deseas enviar")
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

    const address = interaction.options.get(`address`).value;
    const amount = parseInt(interaction.options.get(`monto`).value);

    log(`@${user.username} ejecutó /retirar ${address} ${amount}`, "info");

    const wallet = await getOrCreateAccount(user.id, user.username);
    const balance = await wallet.getBalance("BTC");
    const balanceInSats = balance / 1000;

    const isValidAmount = validateAmountAndBalance(amount, balanceInSats);

    if (!isValidAmount.status)
      return EphemeralMessageResponse(interaction, isValidAmount.content);

    const invoice = await lnurl.requestInvoice({
      lnUrlOrAddress: address,
      tokens: amount,
    });

    if (invoice && invoice.invoice) {
      log(
        `@${interaction.user.username} está pagando la factura ${invoice.invoice}`,
        "info"
      );

      wallet.payInvoice({
        paymentRequest: invoice.invoice,
        onSuccess: () => {
          log(
            `@${interaction.user.username} pagó la factura ${invoice.invoice}`,
            "info"
          );

          interaction.editReply({
            content: `Enviaste ${amount} satoshis a ${address} desde tu billetera`,
            ephemeral: true,
          });
        },
        onError: () => {
          log(
            `@${interaction.user.username} no pudo pagar la factura ${invoice.invoice}`,
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
      `Error en el comando /retirar ejecutado por @${interaction.user.username} - Código de error ${err.code} Mensaje: ${err.message}`,
      "err"
    );

    EphemeralMessageResponse(
      interaction,
      "Ocurrió un error. Los parámetros de este comando son <ln url o address> y <monto>. Si deseas pagar una factura utiliza el comando /pagar"
    );
  }
};

export { create, invoke };
