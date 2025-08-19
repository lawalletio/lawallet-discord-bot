const once = false;
const name = "interactionCreate";

async function invoke(interaction) {
  try {
    if (interaction.isChatInputCommand()) {
      (await import(`#commands/${interaction.commandName}`)).invoke(
        interaction
      );
    }

    if (interaction.isButton()) {
      (await import(`#components/buttons/${interaction.customId}`)).invoke(
        interaction
      );
    }

    if (interaction.isStringSelectMenu()) {
      (await import(`#components/selects/${interaction.customId}`)).invoke(
        interaction
      );
    }

    // Agregar manejo de modales
    if (interaction.isModalSubmit()) {
      (await import(`#components/modals/${interaction.customId}`)).invoke(
        interaction
      );
    }
  } catch (err) {
    console.log("Error al enviar comando");
    console.log(err);
  }
}

export { once, name, invoke };
