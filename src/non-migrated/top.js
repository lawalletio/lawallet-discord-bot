import dedent from "dedent-js";
import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getSumOfDonationAmounts, getTopRanking } from "../handlers/donate.js";
import { AuthorConfig } from "../utils/helperConfig.js";
import { formatter } from "../utils/helperFormatter.js";
import { log } from "../handlers/log.js";
import { validateRelaysStatus } from "../utils/helperFunctions.js";

const availableTypes = ["pozo", "comunidad"];

// Creates an object with the data required by Discord's API to create a SlashCommand
const create = () => {
  const command = new SlashCommandBuilder()
    .setName("top")
    .setDescription("Devuelve el ranking TOP 10 usuarios que enviaron sats")
    .addStringOption((opt) =>
      opt
        .setName("tipo")
        .setDescription(
          "Solicita un ranking específico (parametros: pozo o comunidad)"
        )
        .setRequired(false)
    );

  return command.toJSON();
};

// Called by the interactionCreate event listener when the corresponding command is invoked
const invoke = async (interaction) => {
  try {
    const user = interaction.user;
    if (!user) return;

    await interaction.deferReply();
    await validateRelaysStatus();

    const typeParam = interaction.options.get(`tipo`);

    // const wallet = await getOrCreateAccount(user.id, user.username);
    const cleanedType =
      typeParam?.value && availableTypes.includes(typeParam.value)
        ? typeParam.value
        : "pozo";

    log(`@${user.username} ejecutó /top ${cleanedType}`, "info");

    const isPool = cleanedType === "pozo";

    const topUsers = await getTopRanking(cleanedType);

    let rankOutput = ``;
    if (topUsers && topUsers.length) {
      topUsers.map((user, index) => {
        const trophy =
          index === 0
            ? ":first_place:"
            : index === 1
            ? ":second_place:"
            : index === 2
            ? ":third_place:"
            : ":medal:";

        rankOutput += `
      ${trophy} <@${user.discord_id}>  •  \`${formatter(0, 0).format(
          user.amount
        )} sats\`
        `;

        rankOutput = dedent(rankOutput);
      });

      const title = isPool
        ? "TOP 10 • donadores al pozo"
        : "TOP 10 • usuarios que regalaron sats";

      const informationText = isPool
        ? "Puedes realizar donaciones utilizando el comando /donar <monto>"
        : "Puedes regalar sats con los comandos /zap y /regalar";

      const totalDonated = await getSumOfDonationAmounts(
        isPool ? "pozo" : "comunidad"
      );

      const embed = new EmbedBuilder()
        .setColor(`#0099ff`)
        .setAuthor(AuthorConfig)
        .addFields(
          { name: title, value: rankOutput },
          {
            name: isPool ? "Total donado" : "Total enviado",
            value: `${formatter(0, 0).format(totalDonated)}`,
          },
          {
            name: `Información`,
            value: informationText,
          }
        );

      interaction.editReply({ embeds: [embed] });
    } else {
      const content = isPool
        ? `Aún no hay usuarios que hayan donado al pozo.`
        : `Aún no hay usuarios que hayan enviado sats.`;

      interaction.editReply({
        content,
      });
    }
  } catch (err) {
    log(
      `Error en el comando /top ejecutado por @${interaction.user.username} - Código de error ${err.code} Mensaje: ${err.message}`,
      "err"
    );

    interaction.editReply({
      content: `Ocurrió un error al obtener el ranking`,
    });
  }
};

export { create, invoke };
