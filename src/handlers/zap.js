import { getAndValidateAccount, getTestAccount } from "../handlers/accounts.js";
import { log } from "../handlers/log.js";
import {
  validateAmountAndBalance,
  validateRelaysStatus,
} from "../utils/helperFunctions.js";

const zap = async (
  interaction,
  sender,
  receiver,
  amount,
  onSuccess,
  onError,
  zapMessage
) => {
  try {
    if (amount <= 0)
      return { success: false, message: "No se permiten saldos negativos" };

    const senderWallet = await getAndValidateAccount(interaction, sender.id);

    /*const receiverWallet = await getAndValidateAccount(
      interaction,
      receiver.id
    );*/

    const receiverWallet = await getTestAccount(
      interaction,
      receiver.id
    );

    if (!senderWallet.success) {
      return {
        success: false,
        message: senderWallet.message
      }
    };

    if (!receiverWallet.success) {
      return {
        success: false,
        message: receiverWallet.message
      }
    };

    if (senderWallet.userAccount.discord_id === receiverWallet.userAccount.discord_id)
      return {
        success: false,
        message: "No puedes enviarte sats a vos mismo.",
      };

    const senderBalance = senderWallet.balance;
    const isValidAmount = validateAmountAndBalance(
      amount,
      senderBalance
    );

    if (!isValidAmount.status)
      return { success: false, message: isValidAmount.content };

    const invoiceDetails = await receiverWallet.nwcClient.makeInvoice({ amount: amount * 1000, description: zapMessage });

    log(
      `@${sender.username} va a pagar la factura ${invoiceDetails.invoice}`,
      "info"
    );

    const response = await senderWallet.nwcClient.payInvoice({
      invoice: invoiceDetails.invoice,
    });

    return { success: true, message: "Pago realizado con exito" };
  } catch (err) {
    log(
      `Error al enviar zap de @${sender.username} - Código de error ${err.code} Mensaje: ${err.message}`,
      "err"
    );

    return { success: false, message: "Ocurrió un error al realizar el pago" };
  }
};

export { zap };
