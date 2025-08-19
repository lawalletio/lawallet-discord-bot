import mongoose from "mongoose";

const accountSchema = new mongoose.Schema({
  discord_id: { type: String, required: true },
  discord_username: { type: String, required: true },
  nwc_uri: { type: String, required: true },
});

export default mongoose.models.accounts ||
  mongoose.model("accounts", accountSchema);
