// bot.js (финална версия)
// Node: Discord.js v14 compatible
const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  EmbedBuilder, 
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("Missing TOKEN, CLIENT_ID or GUILD_ID environment variables.");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildEmojisAndStickers] });

// ----------------------------- DATA (класове, спеки, dps type) -----------------------------
const wowClasses = [
  "Druid","Hunter","Mage","Paladin","Priest","Rogue","Shaman","Warlock","Warrior"
];

const classSpecs = {
  Druid: { Tank: ["Guardian"], Healer: ["Restoration"], DPS: ["Balance","Feral"] },
  Hunter: { DPS: ["Beast Mastery","Marksmanship","Survival"] },
  Mage: { DPS: ["Arcane","Fire","Frost"] },
  Paladin: { Tank: ["Protection"], Healer: ["Holy"], DPS: ["Retribution"] },
  Priest: { Healer: ["Holy","Discipline"], DPS: ["Shadow"] },
  Rogue: { DPS: ["Assassination","Combat","Subtlety"] },
  Shaman: { Tank: ["Enhancement"], Healer: ["Restoration"], DPS: ["Enhancement","Elemental"] }, // note: Enhancement can be melee/tank depending on your rules; we handle as Melee by default
  Warlock: { DPS: ["Affliction","Demonology","Destruction"] },
  Warrior: { Tank: ["Protection"], DPS: ["Arms","Fury"] }
};

// mapping spec -> type (Melee/Ranged/Healer/Tank)
const specToType = {
  // Druid
  Balance: "Ranged", Feral: "Melee", Guardian: "Tank", Restoration: "Healer",
  // Hunter
  "Beast Mastery": "Ranged", Marksmanship: "Ranged", Survival: "Melee",
  // Mage
  Arcane: "Ranged", Fire: "Ranged", Frost: "Ranged",
  // Paladin
  Holy: "Healer", Protection: "Tank", Retribution: "Melee",
  // Priest
  Discipline: "Healer", Shadow: "Ranged",
  // Rogue
  Assassination: "Melee", Combat: "Melee", Subtlety: "Melee",
  // Shaman
  Elemental: "Ranged", Enhancement: "Melee", // Enhancement also in some private rules can be Tank — we treat as Melee; Tank path already listed
  // Warlock
  Affliction: "Ranged", Demonology: "Ranged", Destruction: "Ranged",
  // Warrior
  Arms: "Melee", Fury: "Melee"
};

// ----------------------------- HELPERS -----------------------------
function emojiFor(guild, name) {
  if (!guild) return "•";
  const e = guild.emojis.cache.find(em => em.name && em.name.toLowerCase() === name.toLowerCase());
  return e ? e.toString() : "•";
}

function mention(id) {
  return `<@${id}>`;
}

// Build embed fields as required: first row 3 columns (Tank | DPS | Healer),
// second row 2 columns (Melee DPS | Ranged DPS)
function buildRaidEmbed(raid, guild) {
  const embed = new EmbedBuilder()
    .setTitle(`Рейд: ${raid.name}`)
    .setDescription(`Дата/Час: ${raid.datetime}\n${raid.image ? "" : ""}`)
    .setColor(0x00aaff)
    .setTimestamp(new Date())
    .setFooter({ text: "WoW Raid Bot" });

  if (raid.image) embed.setImage(raid.image);

  // prepare lists
  const tanks = raid.members.filter(m => m.role === "Tank");
  const healers = raid.members.filter(m => m.role === "Healer");
  const dps = raid.members.filter(m => m.role === "DPS");
  const melee = dps.filter(m => m.dpsType === "Melee");
  const ranged = dps.filter(m => m.dpsType === "Ranged");

  // Build values (numbered, mention)
  const toList = arr => arr.length ? arr.map((p,i)=>`${i+1}. ${mention(p.id)} (${p.class}${p.spec ? ` - ${p.spec}` : ""})`).join("\n") : "-";

  // First row: Tank | DPS | Healer (inline true each)
  embed.addFields(
    { name: `🛡️ Tank (${tanks.length}/${raid.limits.tankMax})`, value: toList(tanks), inline: true },
    { name: `⚔️ DPS (${dps.length}/${raid.max})`, value: `${toList(melee)}\n${toList(ranged)}`, inline: true },
    { name: `⚕️ Healer (${healers.length}/${raid.limits.healMax})`, value: toList(healers), inline: true }
  );

  // Second row: Melee DPS | Ranged DPS (as separate inline fields)
  embed.addFields(
    { name: `🔪 Melee DPS (${melee.length})`, value: toList(melee), inline: true },
    { name: `🎯 Ranged DPS (${ranged.length})`, value: toList(ranged), inline: true }
  );

  // Extra status field
  const total = raid.members.length;
  const lockedText = raid.locked ? "🔒 Заключен (достигнат лимит)" : (total < raid.min ? `❗ Под минимума (${raid.min})` : `🔓 Отворен`);
  embed.addFields({ name: `Статус`, value: `Общо: ${total}/${raid.max}\n${lockedText}`, inline: false });

  // optionally show icons line (class icons)
  return embed;
}

// check if user already registered in raid
function isRegistered(raid, userId) {
  return raid.members.some(m => m.id === userId);
}

// check counts per role
function countRole(raid, roleName) {
  return raid.members.filter(m => m.role === roleName).length;
}

// ----------------------------- COMMANDS (registration) -----------------------------
const commands = [
  new SlashCommandBuilder()
    .setName("create")
    .setDescription("Създава нов рейд")
    .addStringOption(opt => opt.setName("name").setDescription("Име на рейда").setRequired(true))
    .addStringOption(opt => opt.setName("datetime").setDescription("Дата и час (напр. 26.10.2025 20:00)").setRequired(true))
    .addStringOption(opt => opt.setName("image").setDescription("Линк към картинка за ембед (по избор)").setRequired(false))
    .addIntegerOption(opt => opt.setName("min").setDescription("Минимален брой участници за авто-условие (10)").setRequired(false))
    .addIntegerOption(opt => opt.setName("max").setDescription("Максимален брой участници (10-25)").setRequired(false))
    .addIntegerOption(opt => opt.setName("tankmax").setDescription("Максимум танкове").setRequired(false))
    .addIntegerOption(opt => opt.setName("healmax").setDescription("Максимум хилъри").setRequired(false)),
  new SlashCommandBuilder().setName("help").setDescription("Показва помощ").toJSON(),
  new SlashCommandBuilder().setName("roleinfo").setDescription("Показва role stats (запазено)").toJSON(),
  new SlashCommandBuilder().setName("professions").setDescription("Показва professions (запазено)").toJSON()
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("⚡ Регистриране на командите...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Командите са регистрирани!");
  } catch (err) {
    console.error("❌ Грешка при регистриране на командите:", err);
  }
})();

// ----------------------------- Active Raids storage -----------------------------
/*
  activeRaids: Map<messageId, {
    name, datetime, image,
    min, max, limits: { tankMax, healMax },
    members: [ { id, username, class, role, spec, dpsType } ],
    locked: boolean
  }>
*/
const activeRaids = new Map();

// ----------------------------- Interaction handling -----------------------------
client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isCommand()) {
      if (interaction.commandName === "create") {
        // gather input
        const name = interaction.options.getString("name");
        const datetime = interaction.options.getString("datetime");
        const image = interaction.options.getString("image") || null;
        const min = interaction.options.getInteger("min") || 10;
        const max = interaction.options.getInteger("max") || 25;
        const tankMax = interaction.options.getInteger("tankmax") || 2;
        const healMax = interaction.options.getInteger("healmax") || 3;

        // validate min/max ranges
        const safeMin = Math.max(1, min);
        const safeMax = Math.min(100, Math.max(max, safeMin)); // safety
        if (safeMax < safeMin) {
          return interaction.reply({ content: "Невалиден минимум/максимум.", ephemeral: true });
        }

        // create base raid object (we use message.id as key after reply)
        const raidObj = {
          name,
          datetime,
          image,
          min: safeMin,
          max: safeMax,
          limits: { tankMax, healMax },
          members: [],
          locked: false
        };

        // build initial embed
        const initEmbed = new EmbedBuilder()
          .setTitle(`Рейд: ${name}`)
          .setDescription(`Дата/Час: ${datetime}\nЗаписване: отворено`)
          .setColor(0x00aaff)
          .setFooter({ text: `Min: ${safeMin} • Max: ${safeMax} • TankMax: ${tankMax} • HealerMax: ${healMax}` })
          .setTimestamp();

        if (image) initEmbed.setImage(image);

        // create initial select menu for classes
        const classOptions = wowClasses.map(c => ({ label: c, value: c, description: classSpecs[c] ? Object.keys(classSpecs[c]).map(r => `${r}: ${ (classSpecs[c][r]||[]).join(", ") }`).join(" | ") : "" }));
        const classMenu = new StringSelectMenuBuilder()
          .setCustomId(`raid_select_class`) // actual message-specific id will be appended later
          .setPlaceholder("Избери клас")
          .addOptions(classOptions);

        // reply but we need message ID for mapping; using fetchReply: true
        const row = new ActionRowBuilder().addComponents(classMenu);
        // mention important roles @everyone + specific roles
        // We'll include @everyone mention in content, and also attempt to mention Admin/Moderator/Raid Leader by role names if present
        let mentionContent = `@everyone`;
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          const g = await guild.fetch();
          // attempt to find common role names
          const roleNamesToTry = ["Admin","Moderator","Officer","Raid Leader"];
          const found = [];
          if (g && g.roles && g.roles.cache) {
            for (const rn of roleNamesToTry) {
              const r = g.roles.cache.find(role => role.name.toLowerCase() === rn.toLowerCase());
              if (r) found.push(`<@&${r.id}>`);
            }
          }
          if (found.length) mentionContent += " " + found.join(" ");
        } catch (err) {
          // ignore
        }

        // send reply with components; after sending we will set messageId and create per-message select custom ids
        const reply = await interaction.reply({ content: mentionContent, embeds: [initEmbed], components: [row], fetchReply: true });

        // now we have reply.id; store raid keyed by message id
        const messageId = reply.id;
        // update class select custom id to be message-specific to avoid confusion across raids
        // we need to edit the message to set customId properly (discord.js requires building new components)
        const classMenuSpecific = new StringSelectMenuBuilder()
          .setCustomId(`raid_${messageId}_class`)
          .setPlaceholder("Избери клас")
          .addOptions(classOptions);

        const rowSpecific = new ActionRowBuilder().addComponents(classMenuSpecific);
        await reply.edit({ components: [rowSpecific] });

        // persist
        activeRaids.set(messageId, {
          ...raidObj,
          max: safeMax,
          min: safeMin,
          messageId,
          channelId: reply.channelId,
          members: [],
          locked: false
        });

        return; // done with create

      } else if (interaction.commandName === "help") {
        const helpEmbed = new EmbedBuilder()
          .setTitle("Помощ — WoW Raid Bot")
          .setColor(0x00ff88)
          .setDescription("Команди:\n• /create name datetime [image] [min] [max] [tankMax] [healMax] — създава рейд\n• Използвай селект менюто в съобщението на бота за записване.\n\nПостоянният списък със задачи е имплементиран — селект меню: клас → роля → специализация; авто обновяване; лимити; mentions.")
          .setTimestamp();
        return interaction.reply({ embeds: [helpEmbed], ephemeral: true });
      } else if (interaction.commandName === "roleinfo" || interaction.commandName === "professions") {
        // Placeholder to keep old functionality available — you can paste your earlier implementations here.
        return interaction.reply({ content: "Командата е запазена — старият код за roleinfo/professions може да бъде интегриран тук.", ephemeral: true });
      }
    }

    // ---------- Select menu flows ----------
    if (interaction.isStringSelectMenu()) {
      // customId format patterns we use:
      // raid_<messageId>_class
      // raid_<messageId>_role_<class>
      // raid_<messageId>_spec_<class>_<role>
      const cid = interaction.customId;
      if (!cid.startsWith("raid_")) return; // ignore unrelated

      const parts = cid.split("_");
      // parts[0] = 'raid', parts[1] = messageId, parts[2] = 'class'|'role'|'spec', ...
      const messageId = parts[1];
      const step = parts[2];
      const raid = activeRaids.get(messageId);
      if (!raid) return interaction.reply({ content: "Този рейд вече не е активен.", ephemeral: true });

      // if locked, ignore any further registrations
      if (raid.locked) return interaction.reply({ content: "Рейдът е заключен — достигнат е максимумът.", ephemeral: true });

      if (step === "class") {
        // user chose a class value
        const chosenClass = interaction.values[0];
        // find allowed roles for class (Tank/Healer/DPS)
        const roleOptions = [];
        const specObj = classSpecs[chosenClass] || {};
        // for each role present in specObj add it to options (Tank/Healer/DPS)
        for (const roleName of ["Tank","Healer","DPS"]) {
          if (specObj[roleName] && specObj[roleName].length) roleOptions.push({ label: roleName, value: roleName });
        }
        // if nothing popular, default to DPS
        if (roleOptions.length === 0) roleOptions.push({ label: "DPS", value: "DPS" });

        const roleMenu = new StringSelectMenuBuilder()
          .setCustomId(`raid_${messageId}_role_${chosenClass}`)
          .setPlaceholder("Избери роля")
          .addOptions(roleOptions);

        const row = new ActionRowBuilder().addComponents(roleMenu);
        return interaction.update({ content: `Избери роля за **${chosenClass}**:`, components: [row], embeds: [] });
      }

      if (step === "role") {
        // customId = raid_<messageId>_role_<class>
        const chosenClass = parts.slice(3).join("_"); // class may contain underscores theoretically
        const chosenRole = interaction.values[0]; // "Tank"|"Healer"|"DPS"
        // checks: role limits & overall limit before offering spec
        const totalNow = raid.members.length;
        if (totalNow >= raid.max) {
          // lock and disable
          raid.locked = true;
          // update message to disable components
          await disableRaidComponents(messageId);
          return interaction.reply({ content: `Рейдът вече е пълен (максимум ${raid.max}).`, ephemeral: true });
        }
        if (chosenRole === "Tank") {
          const tankCount = countRole(raid, "Tank");
          if (tankCount >= raid.limits.tankMax) {
            return interaction.reply({ content: `Лимитът за танкове е достигнат (${raid.limits.tankMax}).`, ephemeral: true });
          }
        }
        if (chosenRole === "Healer") {
          const healCount = countRole(raid, "Healer");
          if (healCount >= raid.limits.healMax) {
            return interaction.reply({ content: `Лимитът за хилъри е достигнат (${raid.limits.healMax}).`, ephemeral: true });
          }
        }
        // present spec menu if specs exist
        const specsFor = (classSpecs[chosenClass] && classSpecs[chosenClass][chosenRole]) || [];
        if (!specsFor || specsFor.length === 0) {
          // direct add (no specialization)
          // check duplicate
          if (isRegistered(raid, interaction.user.id)) {
            return interaction.reply({ content: `Вече си записан за този рейд. Можеш да видиш информацията в ембеда.`, ephemeral: true });
          }
          // determine dpsType for roleless or default
          let dpsType = null;
          if (chosenRole === "DPS") {
            // try to infer default by class (some classes are ranged primarily)
            dpsType = ["Hunter","Mage","Warlock"].includes(chosenClass) ? "Ranged" : "Melee";
          }
          raid.members.push({ id: interaction.user.id, username: interaction.user.username, class: chosenClass, role: chosenRole, spec: null, dpsType });
          // update embed message
          await updateRaidMessage(interaction, messageId);
          return interaction.reply({ content: `✔️ Записан си като ${chosenRole} (${chosenClass}).`, ephemeral: true });
        } else {
          // show spec select
          const specMenu = new StringSelectMenuBuilder()
            .setCustomId(`raid_${messageId}_spec_${chosenClass}_${chosenRole}`)
            .setPlaceholder("Избери специализация")
            .addOptions(specsFor.map(s => ({ label: s, value: s, description: specToType[s] ? `${specToType[s]}` : "" })));
          const row = new ActionRowBuilder().addComponents(specMenu);
          return interaction.update({ content: `Избери специализация за **${chosenClass}** (${chosenRole}):`, components: [row], embeds: [] });
        }
      }

      if (step === "spec") {
        // customId = raid_<messageId>_spec_<class>_<role>
        // parts: [ 'raid', messageId, 'spec', class, role ] (class or role may contain underscores)
        // we parse class and role from splitted string: parts[3] = class, parts[4] = role (safe because our class & role names have no underscores)
        const chosenClass = parts[3];
        const chosenRole = parts[4];
        const chosenSpec = interaction.values[0];

        // duplicate check
        if (isRegistered(raid, interaction.user.id)) {
          return interaction.reply({ content: `Вече си записан за този рейд.`, ephemeral: true });
        }

        // check counts & limits again
        const totalNow = raid.members.length;
        if (totalNow >= raid.max) {
          raid.locked = true;
          await disableRaidComponents(messageId);
          return interaction.reply({ content: `Рейдът вече е пълен (максимум ${raid.max}).`, ephemeral: true });
        }
        if (chosenRole === "Tank") {
          const tankCount = countRole(raid, "Tank");
          if (tankCount >= raid.limits.tankMax) {
            return interaction.reply({ content: `Лимитът за танкове е достигнат (${raid.limits.tankMax}).`, ephemeral: true });
          }
        }
        if (chosenRole === "Healer") {
          const healCount = countRole(raid, "Healer");
          if (healCount >= raid.limits.healMax) {
            return interaction.reply({ content: `Лимитът за хилъри е достигнат (${raid.limits.healMax}).`, ephemeral: true });
          }
        }

        // determine dpsType from spec
        const type = specToType[chosenSpec] || (chosenRole === "DPS" ? "Melee" : (chosenRole === "Healer" ? "Healer" : "Tank"));

        // push
        raid.members.push({ id: interaction.user.id, username: interaction.user.username, class: chosenClass, role: chosenRole, spec: chosenSpec, dpsType: type });

        // after adding check if reached max -> lock
        if (raid.members.length >= raid.max) {
          raid.locked = true;
          await disableRaidComponents(messageId);
        }

        await updateRaidMessage(interaction, messageId);
        return interaction.reply({ content: `✔️ Записан si: ${chosenClass} — ${chosenSpec} (${type})`, ephemeral: true });
      }
    }
  } catch (err) {
    console.error("Interaction handler error:", err);
    if (interaction && !interaction.replied) {
      try { await interaction.reply({ content: "Възникна грешка при обработката.", ephemeral: true }); } catch (e) {}
    }
  }
});

// disable components of a raid message (when locking)
async function disableRaidComponents(messageId) {
  const raid = activeRaids.get(messageId);
  if (!raid) return;
  try {
    const ch = await client.channels.fetch(raid.channelId);
    if (!ch) return;
    const msg = await ch.messages.fetch(messageId);
    if (!msg) return;
    // replace components with disabled select (empty placeholder)
    const disabledRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`raid_${messageId}_closed`)
        .setPlaceholder("Записването е затворено")
        .setDisabled(true)
        .addOptions([{ label: "Locked", value: "locked" }])
    );
    await msg.edit({ components: [disabledRow] });
  } catch (err) {
    console.warn("disableRaidComponents error:", err.message || err);
  }
}

// Update raid message embed when members change
async function updateRaidMessage(interactionOrNull, messageId) {
  const raid = activeRaids.get(messageId);
  if (!raid) return;

  // fetch guild for emoji lookup
  const guild = await client.guilds.fetch(GUILD_ID);

  // build embed
  const embed = buildRaidEmbed(raid, guild);

  try {
    const ch = await client.channels.fetch(raid.channelId);
    if (!ch) return;
    const msg = await ch.messages.fetch(messageId);
    if (!msg) return;
    // keep existing components if not locked (we keep class menu)
    let components = [];
    if (!raid.locked) {
      const classMenu = new StringSelectMenuBuilder()
        .setCustomId(`raid_${messageId}_class`)
        .setPlaceholder("Избери клас")
        .addOptions(wowClasses.map(c => ({ label: c, value: c })));
      components = [new ActionRowBuilder().addComponents(classMenu)];
    } else {
      // locked -> disabled component
      components = [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`raid_${messageId}_closed`)
          .setPlaceholder("Записването е затворено")
          .setDisabled(true)
          .addOptions([{ label: "Locked", value: "locked" }])
      )];
    }
    await msg.edit({ embeds: [embed], components });
  } catch (err) {
    console.warn("updateRaidMessage error:", err.message || err);
  }
}

// ----------------------------- CLIENT READY -----------------------------
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ----------------------------- LOGIN -----------------------------
client.login(TOKEN)
  .then(() => console.log("✅ Bot started"))
  .catch(err => console.error("❌ Login error:", err));
