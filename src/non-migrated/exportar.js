import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getOrCreateAccount, LNDOMAIN } from "../handlers/accounts.js";
import { log } from "../handlers/log.js";
import { AuthorConfig } from "../utils/helperConfig.js";
import { EphemeralMessageResponse } from "../utils/helperFunctions.js";

// Creates an object with the data required by Discord's API to create a SlashCommand
const create = () => {
  const command = new SlashCommandBuilder()
    .setName("exportar")
    .setDescription(
      "Exporta tu billetera para conectarla con la aplicación de LaWallet"
    );

  return command.toJSON();
};

// Called by the interactionCreate event listener when the corresponding command is invoked
const invoke = async (interaction) => {
  try {
    await interaction.deferReply({ ephemeral: true });
    const user = interaction.user;
    if (!user) return;

    log(`@${user.username} ejecutó /exportar`, "info");

    const wallet = await getOrCreateAccount(user.id);

    const embed = new EmbedBuilder()
      .setColor(`#0099ff`)
      .setAuthor(AuthorConfig)
      .addFields(
        {
          name: `Exportaste tu cuenta`,
          value: `A continuación podrás copiar la clave privada hexadecimal de tu cuenta.\nIngresa en ${LNDOMAIN} para conectarte`,
        },
        { name: `\u200B`, value: `\u200B` },
        { name: "Clave privada", value: wallet.signer.privateKey },
        { name: `\u200B`, value: `\u200B` },
        {
          name: "ATENCIÓN",
          value: "Este mensaje se eliminará automáticamente en 15 segundos",
        }
      );

    await interaction.editReply({
      embeds: [embed],
      ephemeral: true,
    });

    setTimeout(() => {
      interaction.deleteReply();
    }, 15000);
  } catch (err) {
    log(
      `Error en el comando /exportar ejecutado por @${interaction.user.username} - Código de error ${err.code} Mensaje: ${err.message}`,
      "err"
    );
    EphemeralMessageResponse(interaction, "Ocurrió un error");
  }
};

export { create, invoke };
