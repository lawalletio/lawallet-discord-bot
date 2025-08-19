import { SimpleLock } from "./SimpleLock.js";
import { log } from "./log.js";

const faucetLocks = new Map();
const faucetQueues = new Map();

const getFaucetLock = (faucetId) => {
  if (!faucetLocks.has(faucetId)) {
    faucetLocks.set(faucetId, new SimpleLock());
  }
  return faucetLocks.get(faucetId);
};

const addToFaucetQueue = (faucetId, operation, interaction, faucet) => {
  if (!faucetQueues.has(faucetId)) {
    faucetQueues.set(faucetId, []);
  }

  faucetQueues.get(faucetId).push({
    operation,
    interaction,
    faucet
  });

  // Procesar la cola si es el primer elemento
  if (faucetQueues.get(faucetId).length === 1) {
    processFaucetQueue(faucetId);
  }
};

const processFaucetQueue = async (faucetId) => {
  const queue = faucetQueues.get(faucetId) || [];
  
  while (queue.length > 0) {
    const { operation, interaction, faucet } = queue.shift();
    const lock = getFaucetLock(faucetId);
    const release = await lock.acquire();
    
    log(`Lock adquirido para faucet ${faucetId} - Operación: ${operation}`, "info");
    
    try {
      // Aquí se ejecutarían las funciones handleClaim y handleClose
      // que se pasarían como parámetros o se importarían
    } finally {
      log(`Lock liberado para faucet ${faucetId}`, "info");
      release();
    }
  }
};

export { getFaucetLock, addToFaucetQueue, processFaucetQueue };
