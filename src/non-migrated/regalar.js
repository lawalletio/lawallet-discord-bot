import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { getOrCreateAccount } from "../handlers/accounts.js";
import { createFaucet, updateFaucetMessage } from "../handlers/faucet.js";
import {
  EphemeralMessageResponse,
  FollowUpEphemeralResponse,
  validateAmountAndBalance,
  validateRelaysStatus,
} from "../utils/helperFunctions.js";
import { log } from "../handlers/log.js";

// Creates an object with the data required by Discord's API to create a SlashCommand
const create = () => {
  const command = new SlashCommandBuilder()
    .setName("regalar")
    .setDescription(
      "Crea una factura abierta que cualquier usuario puede reclamar (se descontará de tu saldo)"
    )
    .addNumberOption((opt) =>
      opt
        .setName("monto")
        .setDescription("La cantidad de satoshis a regalar en total")
        .setRequired(true)
    )
    .addNumberOption((opt) =>
      opt
        .setName("usos")
        .setDescription(
          "Cantidad de usuarios que pueden reclamar (cada uno recibe: total sats / users)"
        )
        .setRequired(true)
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

    const amount = parseInt(interaction.options.get(`monto`).value);
    const maxUses = parseInt(interaction.options.get(`usos`).value);

    log(`@${user.username} ejecutó /regalar ${amount} ${maxUses}`, "info");

    if (!amount || !maxUses || amount <= 0 || maxUses <= 0)
      return FollowUpEphemeralResponse(
        interaction,
        "No puedes usar números negativos o flotantes"
      );

    const satsForUser = Number((amount / maxUses).toFixed(0));

    if (satsForUser < 1)
      return FollowUpEphemeralResponse(
        interaction,
        `Ocurrió un error en la división cantidad de sats / usuarios`
      );

    const wallet = await getOrCreateAccount(user.id, user.username);
    const accountBalance = await wallet.getBalance("BTC");
    const satsBalance = accountBalance / 1000;

    const isValidAmount = validateAmountAndBalance(amount, satsBalance);
    if (!isValidAmount.status)
      return FollowUpEphemeralResponse(interaction, isValidAmount.content);

    // a partir de aca, creamos el faucet.
    const new_faucet = await createFaucet(
      user.id,
      user.username,
      satsForUser,
      maxUses
    );

    if (!new_faucet || !new_faucet._id)
      return FollowUpEphemeralResponse(
        interaction,
        "Ocurrió un error al crear el faucet"
      );

    let faucetId = new_faucet._id.toString();
    const accountFaucet = await getOrCreateAccount(faucetId, "faucet-account");

    const zapToAccountFaucet = await wallet.createZap({
      receiverPubkey: accountFaucet.pubkey,
      milisatoshis: amount * 1000,
    });

    log(
      `@${user.username} creo una nueva cuenta faucet: ${accountFaucet.pubkey}`,
      "info"
    );

    await wallet.payInvoice({
      paymentRequest: zapToAccountFaucet.pr,
      onSuccess: async () => {
        const embed = new EmbedBuilder()
          .setAuthor({
            name: `${interaction.user.globalName}`,
            iconURL: `https://cdn.discordapp.com/avatars/${interaction.user.id}/${interaction.user.avatar}`,
          })
          .addFields([
            {
              name: `Faucet disponible:`,
              value: `${interaction.user.toString()} está regalando ${satsForUser} sats a ${
                maxUses === 1
                  ? "1 persona"
                  : `${maxUses} personas \nPresiona reclamar para obtener tu premio. \n\n`
              }`,
            },
            {
              name: `Restantes: ${satsForUser * maxUses}/${
                satsForUser * maxUses
              } sats`,
              value: `${":x:".repeat(maxUses)} \n\n`,
            },
          ])
          .setFooter({
            text: `Identificador: ${faucetId}`,
          });

        const row = new ActionRowBuilder().addComponents([
          new ButtonBuilder()
            .setCustomId("claim")
            .setLabel("Reclamar")
            .setEmoji({ name: `💸` })
            .setStyle(2),
          new ButtonBuilder()
            .setCustomId("closefaucet")
            .setLabel("Cerrar faucet")
            .setEmoji({ name: `✖️` })
            .setStyle(2),
        ]);

        const editedReply = await interaction.editReply({
          embeds: [embed],
          components: [row],
        });

        log(
          `@${user.username} transfirió ${amount} sats a la cuenta faucet: ${accountFaucet.pubkey}`,
          "info"
        );

        await updateFaucetMessage(
          new_faucet,
          editedReply.channelId,
          editedReply.id
        );
      },
      onError: () => {
        log(
          `@${user.username} intentó transferir a la cuenta faucet: ${accountFaucet.pubkey} pero ocurrió un error en el pago`,
          "err"
        );

        EphemeralMessageResponse(
          interaction,
          "Ocurrió un error al transferir los fondos a la cuenta faucet"
        );
      },
    });
  } catch (err) {
    log(
      `Error en el comando /regalar ejecutado por @${interaction.user.username} - Código de error ${err.code} Mensaje: ${err.message}`,
      "err"
    );

    EphemeralMessageResponse(interaction, "Ocurrió un error");
  }
};

export { create, invoke };
