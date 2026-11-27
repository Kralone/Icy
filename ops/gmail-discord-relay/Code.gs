/**
 * Relais Gmail -> Discord pour l'adresse de contact publiée dans les mentions légales.
 *
 * Toutes les 5 minutes, chaque nouveau message arrivé dans la boîte de réception est
 * annoncé dans un salon Discord privé par un webhook, puis reçoit le libellé
 * « Relayé Discord » pour ne pas être annoncé deux fois. Le message reste dans Gmail.
 *
 * Installation : voir README.md à côté de ce fichier.
 * L'URL du webhook est une propriété du script (DISCORD_WEBHOOK_URL), jamais écrite ici.
 */

const RELAY_LABEL = 'Relayé Discord';
const MAX_THREADS_PER_RUN = 20;
const MAX_BODY_CHARS = 1500;
const EMBED_COLOR = 0x22d3ee;

function relayNewMail() {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('DISCORD_WEBHOOK_URL');
  if (!webhookUrl) {
    throw new Error('Propriété DISCORD_WEBHOOK_URL absente : voir README.md.');
  }
  const label = GmailApp.getUserLabelByName(RELAY_LABEL) || GmailApp.createLabel(RELAY_LABEL);
  const query = 'in:inbox -label:"' + RELAY_LABEL + '" newer_than:7d';
  const threads = GmailApp.search(query, 0, MAX_THREADS_PER_RUN);

  threads.forEach(function (thread) {
    thread.getMessages()
      .filter(function (message) { return !message.isDraft(); })
      .slice(-1)
      .forEach(function (message) { postToDiscord(webhookUrl, thread, message); });
    thread.addLabel(label);
  });
}

function postToDiscord(webhookUrl, thread, message) {
  const body = message.getPlainBody().replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  const excerpt = body.length > MAX_BODY_CHARS ? body.slice(0, MAX_BODY_CHARS) + '…' : body;
  const payload = {
    username: 'Contact IceForge',
    allowed_mentions: { parse: [] },
    embeds: [{
      title: truncate(message.getSubject() || '(sans objet)', 250),
      url: 'https://mail.google.com/mail/u/0/#inbox/' + thread.getId(),
      description: excerpt || '(message vide)',
      color: EMBED_COLOR,
      fields: [
        { name: 'De', value: truncate(message.getFrom(), 250), inline: true },
        { name: 'Messages dans la conversation', value: String(thread.getMessageCount()), inline: true }
      ],
      timestamp: message.getDate().toISOString()
    }]
  };
  const response = UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code >= 300) {
    throw new Error('Discord a refusé le message (' + code + ') : ' + response.getContentText().slice(0, 200));
  }
}

function truncate(text, max) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

/** À lancer une fois à la main : crée le déclencheur toutes les 5 minutes. */
function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function (trigger) { return trigger.getHandlerFunction() === 'relayNewMail'; })
    .forEach(function (trigger) { ScriptApp.deleteTrigger(trigger); });
  ScriptApp.newTrigger('relayNewMail').timeBased().everyMinutes(5).create();
}
