import AccountModel from "../schemas/AccountSchema.js";
import { encryptData, decryptData } from "../utils/crypto.js";
import { NWCClient } from "@getalby/sdk";
import { log } from "./log.js";
import { validateNWCURI, testNWCConnection } from "../utils/helperFunctions.js";
import SimpleCache from "./SimpleCache.js";

const accountsCache = new SimpleCache();

const SALT = process.env.SALT ?? "";

// NWC URI de la cuenta de servicio para manejar faucets
const SERVICE_NWC_URI = process.env.SERVICE_NWC_URI ?? "";

const createOrUpdateAccount = async (discord_id, discord_username, nwc_uri) => {
  try {
    const userAccount = await AccountModel.findOne({ discord_id });
    if (userAccount) {
      accountsCache.delete(`account:${discord_id}`);
      userAccount.nwc_uri = encryptData(nwc_uri, SALT);
      await userAccount.save();

      return userAccount;
    }

    const newAccount = new AccountModel({
      discord_id,
      discord_username,
      nwc_uri: encryptData(nwc_uri, SALT),
    });

    await newAccount.save();

    return newAccount;
  } catch (err) {
    console.log(err);
    return null;
  }
};

// Función para obtener la cuenta de servicio que maneja los faucets
const getServiceAccount = async (interaction) => {
  try {
    const cachedAccount = accountsCache.get(`account:service`);
    if (cachedAccount) return cachedAccount;

    log(`Obteniendo cuenta de servicio para faucets`, "info");

    // Validar formato del NWC URI de servicio
    const formatValidation = validateNWCURI(SERVICE_NWC_URI);
    if (!formatValidation.valid) {
      log(`NWC URI de servicio inválido: ${formatValidation.error}`, "err");
      return {
        success: false,
        message: `❌ **Error en configuración de servicio:** ${formatValidation.error}`
      };
    }

    // Probar la conexión NWC de servicio
    const connectionTest = await testNWCConnection(SERVICE_NWC_URI);
    if (!connectionTest.valid) {
      log(`Error de conexión NWC de servicio: ${connectionTest.error}`, "err");
      return {
        success: false,
        message: `❌ **Error de conexión de servicio:** ${connectionTest.error}`
      };
    }

    // Crear cliente NWC de servicio
    const nwcClient = new NWCClient({
      nostrWalletConnectUrl: SERVICE_NWC_URI
    });

    log(`Cuenta de servicio validada exitosamente - Balance: ${connectionTest.balance} sats`, "info");

    const createdAccount = {
      success: true,
      nwcClient,
      balance: connectionTest.balance,
      isServiceAccount: true, // Flag para identificar que es cuenta de servicio
      accountInfo: {
        type: 'service',
        purpose: 'faucet_management',
        balance: connectionTest.balance
      }
    };

    accountsCache.set(`account:service`, createdAccount, 7200000);
    return createdAccount;
  } catch (err) {
    log(`Error obteniendo cuenta de servicio: ${err.message}`, "err");
    return {
      success: false,
      message: "❌ **Error inesperado al obtener la cuenta de servicio.**"
    };
  }
};

const getAndValidateAccount = async (interaction, discord_id) => {
  try {
    const userData = await interaction.guild.members.fetch(discord_id);

    const cachedAccount = accountsCache.get(`account:${discord_id}`);
    if (cachedAccount && cachedAccount.success) {
      try {
        log(`@${userData.user.username} - Usando cuenta cacheada, actualizando balance`, "info");
        
        const currentBalance = await cachedAccount.nwcClient.getBalance();
        const updatedBalance = Number(currentBalance.balance.toString()) / 1000;
        
        cachedAccount.balance = updatedBalance;
        
        log(`@${userData.user.username} - Balance actualizado: ${updatedBalance} sats`, "info");
        
        return cachedAccount;
      } catch (balanceError) {
        log(`@${userData.user.username} - Error al actualizar balance cacheado: ${balanceError.message}`, "err");
      }
    }
    
    const userAccount = await AccountModel.findOne({ discord_id });
    if (!userAccount) {
      log(`@${userData.user.username} no tiene cuenta registrada`, "err");

      if (interaction.user.id === discord_id) {
        return {
          success: false,
          message: "❌ **No tienes una cuenta registrada.**\n\nUsa el comando `/connect` para conectar tu billetera NWC."
        }
      } else {
        return {
          success: false,
          message: "❌ **El usuario al que intentas enviar no tiene una cuenta registrada.**"
        }
      }
    }

    const nwcUri = decryptData(userAccount.nwc_uri, SALT);
    if (!nwcUri) {
      log(`@${userData.user.username} - Error al desencriptar NWC URI`, "err");

      if (interaction.user.id === discord_id) {
        return {
          success: false,
          message: "❌ **Error al recuperar tu conexión NWC.**\n\nUsa el comando `/connect` para reconectar tu billetera."
        }
      } else {
        return {
          success: false,
          message: "❌ **Error al recuperar la conexión NWC del usuario.**"
        }
      }
    }

    const formatValidation = validateNWCURI(nwcUri);
    if (!formatValidation.valid) {
      log(`@${userData.user.username} - NWC URI inválido: ${formatValidation.error}`, "err");

      if (interaction.user.id === discord_id) {
        return {
          success: false,
          message: `❌ **URI de conexión inválido:** ${formatValidation.error}\n\nUsa el comando \`/connect\` para reconectar tu billetera.`
        }
      } else {
        return {
          success: false,
          message: `❌ **El URI de conexión del usuario al que intentas enviar es inválido.**`
        }
      }
    }

    const connectionTest = await testNWCConnection(nwcUri);
    if (!connectionTest.valid) {
      log(`@${userData.user.username} - Error de conexión NWC: ${connectionTest.error}`, "err");

      return {
        success: false,
        message: `❌ **Error de conexión:** ${connectionTest.error}\n\nVerifica que tu billetera o la del usuario al que intentas enviar esté correctamente conectada. Usa \`/connect\` para reconectar si es necesario.`
      }
    }

    const nwcClient = new NWCClient({
      nostrWalletConnectUrl: nwcUri
    });

    log(`@${userData.user.username} - Conexión NWC validada exitosamente`, "info");

    const createdAccount = {
      success: true,
      nwcClient,
      balance: connectionTest.balance,
      userAccount
    };

    accountsCache.set(`account:${discord_id}`, createdAccount, 7200000);
    return createdAccount;
  } catch (err) {
    log(`Error en getAndValidateAccount para @${userData.user.username}: ${err.message}`, "err");
    return {
      success: false,
      message: "❌ **Error inesperado al validar tu cuenta.**\n\nUsa el comando `/connect` para reconectar tu billetera."
    }
  }
};

export { createOrUpdateAccount, getAndValidateAccount, getServiceAccount };

