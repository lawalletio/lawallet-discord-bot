import FaucetModel from "../schemas/FaucetSchema.js";
import { FAUCET_COMMISSION } from "../utils/faucetConfig.js";

const createFaucet = async (owner_id, owner_username, amount, maxUses) => {
  try {
    const newFaucet = new FaucetModel({
      owner_id,
      owner_username,
      amount,
      maxUses,
      channelId: 0,
      messageId: 0,
      claimersIds: [],
      closed: false,
    });

    const result = newFaucet.save();
    return result;
  } catch (err) {
    return null;
  }
};

const getFaucet = async (faucet_id) => {
  if (!faucet_id) return null;

  try {
    const faucet = await FaucetModel.findOne({
      _id: faucet_id,
    });

    if (faucet) return faucet;
  } catch (err) {
    return null;
  }

  return null;
};

const getAllOpenFaucets = async (discord_id) => {
  if (!discord_id) return null;

  try {
    const faucets = await FaucetModel.find({
      owner_id: discord_id,
      closed: false,
    });

    if (faucets) return faucets;
  } catch (err) {
    return null;
  }

  return null;
};

const updateFaucetMessage = async (faucet, channelId, lastMessageId) => {
  try {
    if (!faucet) return null;

    faucet.channelId = channelId;
    faucet.messageId = lastMessageId;
    await faucet.save();

    return faucet;
  } catch (err) {
    console.log(err);
    return null;
  }
};

const addClaimerOnFaucet = async (faucet_id, new_claimer) => {
  try {
    const faucet = await getFaucet(faucet_id);
    if (!faucet) return null;

    faucet.claimersIds = [...faucet.claimersIds, new_claimer];
    await faucet.save();

    return faucet;
  } catch (err) {
    console.log(err);
    return null;
  }
};

const closeFaucet = async (faucet_id) => {
  try {
    const faucet = await getFaucet(faucet_id);
    if (!faucet) return null;

    faucet.closed = true;
    await faucet.save();

    return faucet;
  } catch (err) {
    console.log(err);
    return null;
  }
};

export {
  createFaucet,
  getFaucet,
  addClaimerOnFaucet,
  updateFaucetMessage,
  getAllOpenFaucets,
  closeFaucet,
};
