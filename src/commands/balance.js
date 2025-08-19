import {
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { getAndValidateAccount } from "../handlers/accounts.js";
import { formatter } from "../utils/helperFormatter.js";
import { log } from "../handlers/log.js";

const create = () => {
  const command = new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Devuelve el saldo de tu billetera.");

  return command.toJSON();
};

const invoke = async (interaction) => {
  try {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.user;
    if (!user) throw new Error("No user interaction found");

    log(`@${user.username} utilizó /balance`, "info");

    const accountResult = await getAndValidateAccount(interaction, user.id);
    if (!accountResult.success) {
      return EphemeralMessageResponse(interaction, accountResult.message);
    }

    const { nwcClient } = accountResult;
    const response = await nwcClient.getBalance();
    const balance = response.balance / 1000;
    if (!response || !balance) throw new Error("Error al obtener el balance");

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `Información de tu cuenta`,
        iconURL: `https://cdn.discordapp.com/avatars/${interaction.user.id}/${interaction.user.avatar}`,
      })
      .addFields([
        {
          name: `Balance`,
          value: `**${formatter(0, 0).format(balance)} satoshis**`,
        }
      ]);

    log(
      `Balance de @${user.username} resuelto: ${balance} satoshis`,
      "info"
    );

    await interaction.editReply({
      embeds: [embed],
    });

  } catch (err) {
    log(
      `Error en el comando /balance ejecutado por @${interaction.user.username} - Código de error ${err.code} Mensaje: ${err.message}`,
      "err"
    );

    await interaction.editReply({
      content: "❌ Ocurrió un error inesperado al obtener tu balance",
      ephemeral: true
    });
  }
};

export { create, invoke };
