import { SlashCommandBuilder } from "discord.js";
import { updateUserRank } from "../handlers/donate.js";
import { log } from "../handlers/log.js";
import { EphemeralMessageResponse } from "../utils/helperFunctions.js";

import { zap } from "../handlers/zap.js";

// Creates an object with the data required by Discord's API to create a SlashCommand
const create = () => {
  const command = new SlashCommandBuilder()
    .setName("zap")
    .setDescription("Regala sats a un usuario en discord")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("Usuario a zappear").setRequired(true)
    )
    .addNumberOption((opt) =>
      opt
        .setName("monto")
        .setDescription("La cantidad de satoshis a transferir")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("message")
        .setDescription("Un mensaje de la transferencia")
        .setRequired(false)
    );

  return command.toJSON();
};

// Called by the interactionCreate event listener when the corresponding command is invoked
const invoke = async (interaction) => {
  try {
    const user = interaction.user;
    if (!user) return;

    await interaction.deferReply({ ephemeral: true });

    const receiver = interaction.options.get(`user`);
    const amount = parseInt(interaction.options.get(`monto`).value);

    log(
      `@${user.username} ejecutó /zap ${receiver.user.username} ${amount}`,
      "info"
    );

    const receiverData = await interaction.guild.members.fetch(
      receiver.user.id
    );

    const zapMessage = interaction.options.get(`message`)
      ? interaction.options.get(`message`).value
      : `${user.username} te envío ${amount} sats a través de discord`;

    const onSuccess = async () => {
      try {
        await updateUserRank(interaction.user.id, "comunidad", amount);

        log(
          `@${user.username} pago la factura del zap hacia @${receiver.user.username}`,
          "info"
        );

        await interaction.deleteReply();

        await interaction.channel.send({
          content: `${interaction.user.toString()} envió ${amount} satoshis a ${receiverData.toString()}`,
        });
      } catch (err) {
        console.log(err);
        EphemeralMessageResponse(interaction, "Ocurrió un error");
      }
    };

    const onError = () => {
      log(
        `@${user.username} tuvo un error al realizar el pago del zap hacia @${receiver.user.username}`,
        "err"
      );

      EphemeralMessageResponse(interaction, "Ocurrió un error");
    };

    const { success, message } = await zap(
      interaction,
      user,
      receiverData.user,
      amount,
      onSuccess,
      onError,
      zapMessage
    );

    if (!success) {
      return EphemeralMessageResponse(interaction, message);
    } else{
      onSuccess();
    }
  } catch (err) {
    log(
      `Error en el comando /zap ejecutado por @${interaction.user.username} - Código de error ${err.code} Mensaje: ${err.message}`,
      "err"
    );

    EphemeralMessageResponse(interaction, "Ocurrió un error");
  }
};

export { create, invoke };
