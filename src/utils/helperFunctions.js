import NDK, { NDKEvent, NDKRelaySet } from "@nostr-dev-kit/ndk";
import { connectedNdk, knownRelays } from "../../Bot.js";
import { log } from "../handlers/log.js";
import SimpleCache from "../handlers/SimpleCache.js";
import { NWCClient } from "@getalby/sdk";
import bolt11 from 'bolt11';

export const signupCache = new SimpleCache();

export const validateNWCURI = (nwcUri) => {
  try {
    if (!nwcUri || typeof nwcUri !== 'string') {
      return { valid: false, error: 'El URI de NWC no puede estar vacío' };
    }

    if (!nwcUri.startsWith('nostr+walletconnect://')) {
      return { valid: false, error: 'El URI debe comenzar con "nostr+walletconnect://"' };
    }

    const uriParts = nwcUri.replace('nostr+walletconnect://', '').split('?');
    if (uriParts.length !== 2) {
      return { valid: false, error: 'Formato de URI inválido' };
    }

    const [pubkey, params] = uriParts;
    
    if (!/^[0-9a-fA-F]{64}$/.test(pubkey)) {
      return { valid: false, error: 'Clave pública inválida' };
    }

    const searchParams = new URLSearchParams(params);
    const relay = searchParams.get('relay');
    const secret = searchParams.get('secret');

    if (!relay) {
      return { valid: false, error: 'Falta el parámetro "relay"' };
    }

    if (!secret) {
      return { valid: false, error: 'Falta el parámetro "secret"' };
    }

    try {
      new URL(relay);
    } catch {
      return { valid: false, error: 'URL del relay inválida' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Error al validar el URI' };
  }
};

export const testNWCConnection = async (nwcUri) => {
  let nwc = null;
  try {
    nwc = new NWCClient({
      nostrWalletConnectUrl: nwcUri
    });

    const response = await nwc.getBalance();
    
    return { valid: true, balance: Number(response.balance.toString()) / 1000 };
  } catch (error) {
    return { 
      valid: false, 
      error: `Error de conexión: ${error.message}` 
    };
  }
};

export const requiredEnvVar = (key) => {
  const envVar = process.env[key];
  if (undefined === envVar) {
    throw new Error(`Environment process ${key} must be defined`);
  }
  return envVar;
};

const validateAmountAndBalance = (amount, balance) => {
  if (amount <= 0)
    return {
      status: false,
      content: "No puedes usar números negativos o flotantes",
    };

  if (amount > balance)
    return {
      status: false,
      content: `No tienes saldo suficiente para realizar esta acción. \nRequerido: ${amount} - balance en tu billetera: ${balance}`,
    };

  return {
    status: true,
    content: "",
  };
};

export const normalizeLNDomain = (domain) => {
  try {
    const iURL = new URL(domain);
    return iURL.hostname;
  } catch {
    return "";
  }
};

const handleBotResponse = async (Interaction, objConfig) => {
  Interaction.deferred
    ? await Interaction.editReply(objConfig)
    : await Interaction.reply(objConfig);
};

const EphemeralMessageResponse = async (Interaction, content) => {
  const objectResponse = {
    content,
    ephemeral: true,
  };

  await handleBotResponse(Interaction, objectResponse);
};
const TimedMessage = (message, channel, duration) => {
  channel
    .send(message)
    .then((m) =>
      setTimeout(
        async () => (await channel.messages.fetch(m)).delete(),
        duration
      )
    );
  return;
};
const FollowUpEphemeralResponse = async (Interaction, content) => {
  await Interaction.deleteReply();

  return Interaction.followUp({
    content: content,
    ephemeral: true,
  });
};

const relaysProfileList = [
  "wss://relay.damus.io",
  "wss://relay.hodl.ar",
  "wss://nostr-pub.wellorder.net",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://nostr.wine",
];

const publishProfile = async (wallet, user) => {
  if (!wallet || !user) throw new Error("Wallet or Discord User not found");

  try {
    const tmpNdk = new NDK({
      explicitRelayUrls: relaysProfileList,
      autoConnectUserRelays: false,
      signer: wallet.signer,
    });

    // await tmpNdk.connect();

    let profileContent = {
      pubkey: wallet.pubkey,
      name: user.globalName,
      about: `This nostr account was created by LNBot for the discord user @${user.username}`,
      picture: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}`,
      banner: "https://m.primal.net/HIPQ.gif",
      website: "lnbot.io",
    };

    if (wallet.walias) {
      profileContent.nip05 = wallet.walias;
      profileContent.lud16 = wallet.walias;
    }

    let eventProfile = {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      content: JSON.stringify(profileContent),
    };

    const ndkEvent = new NDKEvent(tmpNdk, eventProfile);
    await ndkEvent.sign();

    let relaySet = NDKRelaySet.fromRelayUrls(relaysProfileList, tmpNdk, true);
    await ndkEvent.publish(relaySet);

    return;
  } catch (err) {
    console.log(err);
    return;
  }
};

async function validateRelaysStatus() {
  let connectedRelays = connectedNdk.pool.connectedRelays();

  await Promise.all(
    knownRelays.map(async (relayUrl) => {
      let isRelayConnected = connectedRelays.find(
        (relay) => relay.url === relayUrl
      );

      if (!isRelayConnected) {
        let disconnectedRelay = connectedNdk.pool.relays.get(relayUrl);

        if (disconnectedRelay) {
          log(`reconectando relay: ${disconnectedRelay.url}`, "done");
          await disconnectedRelay.connect();
        }
      }
    })
  );

  return;
}

async function getSignupInfo(federation) {
  const infoFromCache = signupCache.get(`signup:${federation.id}`);
  if (infoFromCache) return infoFromCache;

  const signupInfo = await federation.signUpInfo();

  let ttl = 86400 * 1000; // 24 hours
  signupCache.set(`signup:${federation.id}`, signupInfo, ttl);

  return signupInfo;
}

async function existIdentity(federation, username) {
  const infoFromCache = signupCache.get(`signup:${federation.id}:${username}`);

  if (infoFromCache) {
    return infoFromCache;
  } else {
    const existIdentity = await federation.existIdentity(username);

    if (existIdentity) {
      let ttl = 86400 * 1000; // 24 hours
      signupCache.set(`signup:${federation.id}:${username}`, true, ttl);
      return true;
    }

    return false;
  }
}

export const validateAndDecodeBOLT11 = (bolt11String) => {
  try {
    // Verificar que no esté vacío
    if (!bolt11String || typeof bolt11String !== 'string') {
      return { valid: false, error: 'El BOLT11 no puede estar vacío' };
    }

    // Decodificar el BOLT11
    const decoded = bolt11.decode(bolt11String);
    
    if (!decoded) {
      return { valid: false, error: 'No se pudo decodificar el BOLT11' };
    }

    // Verificar que tenga un monto válido
    if (!decoded.satoshis && decoded.millisatoshis) {
      decoded.satoshis = Math.floor(decoded.millisatoshis / 1000);
    }

    if (!decoded.satoshis) {
      return { valid: false, error: 'El BOLT11 no tiene un monto válido' };
    }

    return {
      valid: true,
      decoded,
      amount: decoded.satoshis,
      description: decoded.description || 'Sin descripción',
      timestamp: decoded.timestamp,
      expiry: decoded.expiry
    };

  } catch (error) {
    return { 
      valid: false, 
      error: `Error al decodificar BOLT11: ${error.message}` 
    };
  }
};

// Función para verificar si el BOLT11 ha expirado
export const isBOLT11Expired = (decodedBOLT11) => {
  if (!decodedBOLT11.timestamp || !decodedBOLT11.expiry) {
    return false; // Si no tiene timestamp o expiry, asumimos que no expira
  }

  const currentTime = Math.floor(Date.now() / 1000);
  const expiryTime = decodedBOLT11.timestamp + decodedBOLT11.expiry;
  
  return currentTime > expiryTime;
};

export {
  EphemeralMessageResponse,
  TimedMessage,
  FollowUpEphemeralResponse,
  handleBotResponse,
  publishProfile,
  validateAmountAndBalance,
  validateRelaysStatus,
  getSignupInfo,
  existIdentity,
};
