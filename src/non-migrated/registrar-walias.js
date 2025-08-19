import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { getOrCreateAccount, LNDOMAIN } from "../handlers/accounts.js";
import {
  EphemeralMessageResponse,
  existIdentity,
  getSignupInfo,
  normalizeLNDomain,
  validateRelaysStatus,
} from "../utils/helperFunctions.js";
import { AuthorConfig } from "../utils/helperConfig.js";
import { log } from "../handlers/log.js";

// Creates an object with the data required by Discord's API to create a SlashCommand
const create = () => {
  const command = new SlashCommandBuilder()
    .setName("registrar-walias")
    .setDescription(
      `Registra un nombre de usuario@${normalizeLNDomain(LNDOMAIN)}`
    )
    .addStringOption((opt) =>
      opt
        .setName("nombre")
        .setDescription(
          `El nombre de usuario que quieres registrar (nombre@${normalizeLNDomain(
            LNDOMAIN
          )})`
        )
        .setRequired(true)
    );

  return command.toJSON();
};

const regexUserName = /^[A-Za-z0123456789]+$/;

// Called by the interactionCreate event listener when the corresponding command is invoked
const invoke = async (interaction) => {
  try {
    const user = interaction.user;
    if (!user) return;

    await interaction.deferReply({ ephemeral: true });
    await validateRelaysStatus();

    const username = interaction.options.get(`nombre`).value;
    log(`@${user.username} ejecutó /registrar-walias ${username}`, "info");

    if (!regexUserName.test(username))
      return interaction.editReply({
        content:
          "Nombre de usuario inválido. Use únicamente carácteres a-z y 0-9",
      });

    const wallet = await getOrCreateAccount(user.id, interaction.user.username);
    if (!wallet.lnurlpData) await wallet.fetch();

    const existWalias = wallet.walias;
    if (existWalias && existWalias.length)
      return interaction.editReply({
        content: `Ya tienes un walias asociado a tu cuenta: ${
          "`" + existWalias + "`"
        }`,
      });

    const signupInfo = await getSignupInfo(wallet.federation);
    if (!signupInfo || !signupInfo.enabled)
      return interaction.editReply({ content: "Registro deshabilitado" });

    const nameWasTaken = await existIdentity(wallet.federation, username);
    if (nameWasTaken)
      return interaction.editReply({
        content:
          "El nombre de usuario que elegiste ya existe en la base de datos.",
      });

    if (signupInfo.milisatoshis) {
      const bal = await wallet.getBalance("BTC");

      if (bal < signupInfo.milisatoshis)
        return interaction.editReply({
          content: `No tienes saldo suficiente para abonar el registro de un walias.\nEl costo es de **${
            signupInfo.milisatoshis / 1000
          } satoshis**.`,
        });
    }

    const embed = new EmbedBuilder()
      .setAuthor(AuthorConfig)
      .addFields([
        {
          name: `Registrar ${username}@${normalizeLNDomain(LNDOMAIN)}`,
          value: signupInfo.milisatoshis
            ? `Deberás abonar ${
                signupInfo.milisatoshis / 1000
              } sats para obtener este walias.`
            : "El registro es gratuito, simplemente presiona registrar para completar la operación",
        },
        {
          name: "**Atención**",
          value:
            "Este registro es único, por lo que no podrás volver a registrar un nuevo walias en el futuro.\n\n¿Estás seguro de que quieres comprarlo?",
        },
      ])
      .setFooter({
        text: `Identificador: ${username}`,
      });

    const row = new ActionRowBuilder().addComponents([
      new ButtonBuilder()
        .setCustomId("registerhandle")
        .setLabel("Registrar")
        .setEmoji({ name: `🔨` })
        .setStyle(2),
    ]);

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });
  } catch (err) {
    log(
      `Error en el comando /registrar-walias ejecutado por @${interaction.user.username} - Código de error ${err.code} Mensaje: ${err.message}`,
      "err"
    );
    EphemeralMessageResponse(interaction, "Ocurrió un error");
  }
};

export { create, invoke };
