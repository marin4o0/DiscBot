async function handleProfessions(interaction) {
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.members.fetch();
  await guild.emojis.fetch();

  const selectedProfession = interaction.options.getString("profession");

  const embed = {
    color: 0x0099ff,
    title: "Информация за професии",
    description: "",
    fields: [],
    timestamp: new Date(),
    footer: { text: "WoW Discord Bot" }
  };

  if (selectedProfession) {
    const profRole = guild.roles.cache.find(r => r.name.toLowerCase() === selectedProfession.toLowerCase());
    if (!profRole) {
      embed.description = "Не е намерена такава професия.";
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    embed.color = profRole.color || embed.color;

    const members = profRole.members;
    const emoji = getEmojiByName(guild, selectedProfession.toLowerCase()) || "•";

    embed.fields.push({
      name: `${emoji} ${selectedProfession}`,
      value: `Брой: ${members.size}`,
      inline: false
    });

    return interaction.reply({ embeds: [embed] });
  }

  // Списък за всички професии (без повторно деклариране)
  let professionsList = "";

  for (const prof of professions.sort()) {
    const profRole = guild.roles.cache.find(r => r.name.toLowerCase() === prof.toLowerCase());
    if (!profRole) continue;

    const members = profRole.members;
    if (members.size === 0) continue;

    const emoji = getEmojiByName(guild, prof.toLowerCase()) || "•";
    professionsList += `${emoji} ${prof} - ${members.size}\n`;
  }

  if (professionsList === "") {
    embed.description = "Няма намерени членове с избрани професии.";
  } else {
    embed.fields.push({
      name: "Професии",
      value: professionsList,
      inline: false
    });
  }

  return interaction.reply({ embeds: [embed] });
}
