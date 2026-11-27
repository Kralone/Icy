/**
 * Relais Gmail -> Discord pour l'adresse de contact publiée dans les mentions légales.
 *
 * Toutes les 5 minutes, chaque nouveau message arrivé dans la boîte de réception est
 * annoncé (expéditeur et objet seulement) dans un salon Discord privé par un webhook, puis reçoit le libellé
 * « Relayé Discord » pour ne pas être annoncé deux fois. Le message reste dans Gmail.
 *
 * Installation : voir README.md à côté de ce fichier.
 * L'URL du webhook est une propriété du script (DISCORD_WEBHOOK_URL), jamais écrite ici.
 */

const RELAY_LABEL = 'Relayé Discord';
const KEEP_LABEL = 'À conserver';
const MAIL_RETENTION = '1y';          // emails : 12 mois après le dernier échange
const NOTICE_RETENTION_DAYS = 90;     // annonces Discord : 3 mois
const NOTICES_PROPERTY = 'DISCORD_NOTICES';
const MAX_THREADS_PER_RUN = 20;
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
  // Seuls l'expéditeur et l'objet partent sur Discord : le contenu reste dans Gmail.
  const payload = {
    username: 'Contact IceForge',
    allowed_mentions: { parse: [] },
    embeds: [{
      title: truncate(message.getSubject() || '(sans objet)', 250),
      url: 'https://mail.google.com/mail/u/0/#inbox/' + thread.getId(),
      description: 'Nouvel email reçu sur l\'adresse de contact. À lire dans Gmail.',
      color: EMBED_COLOR,
      fields: [
        { name: 'De', value: truncate(message.getFrom(), 250), inline: true }
      ],
      timestamp: message.getDate().toISOString()
    }]
  };
  const response = UrlFetchApp.fetch(webhookUrl + (webhookUrl.indexOf('?') < 0 ? '?' : '&') + 'wait=true', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code >= 300) {
    throw new Error('Discord a refusé le message (' + code + ') : ' + response.getContentText().slice(0, 200));
  }
  rememberNotice(JSON.parse(response.getContentText()).id);
}

function rememberNotice(messageId) {
  const properties = PropertiesService.getScriptProperties();
  const notices = JSON.parse(properties.getProperty(NOTICES_PROPERTY) || '[]');
  notices.push({ id: messageId, at: Date.now() });
  properties.setProperty(NOTICES_PROPERTY, JSON.stringify(notices));
}

/**
 * Durées de la politique de confidentialité : emails mis à la corbeille 12 mois après le dernier
 * échange (sauf libellé « À conserver »), annonces Discord supprimées après 3 mois.
 */
function applyRetention() {
  const trashQuery = 'label:"' + RELAY_LABEL + '" -label:"' + KEEP_LABEL + '" older_than:' + MAIL_RETENTION;
  let threads;
  do {
    threads = GmailApp.search(trashQuery, 0, 100);
    threads.forEach(function (thread) { thread.moveToTrash(); });
  } while (threads.length === 100);

  const webhookUrl = PropertiesService.getScriptProperties().getProperty('DISCORD_WEBHOOK_URL');
  const properties = PropertiesService.getScriptProperties();
  const cutoff = Date.now() - NOTICE_RETENTION_DAYS * 24 * 3600 * 1000;
  const kept = [];
  JSON.parse(properties.getProperty(NOTICES_PROPERTY) || '[]').forEach(function (notice) {
    if (notice.at >= cutoff || !webhookUrl) {
      kept.push(notice);
      return;
    }
    const code = UrlFetchApp.fetch(webhookUrl.split('?')[0] + '/messages/' + notice.id,
      { method: 'delete', muteHttpExceptions: true }).getResponseCode();
    if (code >= 300 && code !== 404) kept.push(notice);
  });
  properties.setProperty(NOTICES_PROPERTY, JSON.stringify(kept));
}

function truncate(text, max) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

/** À lancer une fois à la main : relais toutes les 5 minutes, durées de conservation chaque nuit. */
function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function (trigger) {
      return ['relayNewMail', 'applyRetention'].indexOf(trigger.getHandlerFunction()) >= 0;
    })
    .forEach(function (trigger) { ScriptApp.deleteTrigger(trigger); });
  ScriptApp.newTrigger('relayNewMail').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('applyRetention').timeBased().everyDays(1).atHour(4).create();
}
