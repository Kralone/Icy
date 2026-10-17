"""Génère les tableaux de bord Grafana d'IceForge dans grafana/dashboards/.

Les JSON produits sont versionnés et provisionnés en lecture seule : modifier ce script,
le relancer (python ops/monitoring/grafana/generate_dashboards.py), puis committer les deux.
"""

import json
from pathlib import Path

OUT = Path(__file__).resolve().parent / "dashboards"
DS = {"type": "prometheus", "uid": "prometheus"}
NO_DATA = "Pas de donnée"

# Couleurs de statut : vert = normal, orange = à surveiller, rouge = action.
GREEN, ORANGE, RED, BLUE = "green", "orange", "red", "blue"

# Requêtes applicatives : le WebSocket (connexions longues) et l'actuator faussent latence et débit.
HTTP = 'job="backend", uri!~"/ws.*|/actuator.*"'
# Systèmes de fichiers sur disque : écarte tmpfs, overlay Docker et lecteurs Windows montés sous WSL.
DISKS = 'fstype=~"ext[234]|xfs|btrfs"'


class Board:
    def __init__(self, uid, title, description, variables=()):
        self.uid, self.title, self.description = uid, title, description
        self.variables = list(variables)
        self.panels, self.y, self.x, self.row_h = [], 0, 0, 0
        self.next_id = 1

    def row(self, title):
        self._newline()
        self._add({"type": "row", "title": title, "collapsed": False, "panels": []}, 24, 1)

    def _newline(self):
        if self.x:
            self.y += self.row_h
            self.x, self.row_h = 0, 0

    def _add(self, panel, w, h):
        if self.x + w > 24:
            self._newline()
        panel["id"] = self.next_id
        panel["gridPos"] = {"x": self.x, "y": self.y, "w": w, "h": h}
        self.next_id += 1
        self.panels.append(panel)
        self.x += w
        self.row_h = max(self.row_h, h)
        if self.x >= 24:
            self._newline()

    def stat(self, title, expr, unit="short", steps=None, w=4, h=4, mappings=None, decimals=None,
             description=None):
        defaults = {
            "unit": unit,
            "noValue": NO_DATA,
            "color": {"mode": "thresholds"},
            "thresholds": {"mode": "absolute", "steps": _steps(steps or [(None, BLUE)])},
            "mappings": mappings or [],
        }
        if decimals is not None:
            defaults["decimals"] = decimals
        self._add({
            "type": "stat", "title": title, "datasource": DS,
            **({"description": description} if description else {}),
            "targets": [_target(expr, instant=True)],
            "fieldConfig": {"defaults": defaults, "overrides": []},
            "options": {
                "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                "colorMode": "background", "graphMode": "none", "justifyMode": "center",
                "textMode": "value", "wideLayout": True,
            },
        }, w, h)

    def series(self, title, targets, unit="short", w=12, h=8, stack=False, min_zero=True,
               description=None, overrides=None):
        custom = {
            "drawStyle": "line", "lineWidth": 2, "fillOpacity": 15 if stack else 5,
            "showPoints": "never", "spanNulls": False,
            "stacking": {"mode": "normal" if stack else "none", "group": "A"},
        }
        defaults = {"unit": unit, "noValue": NO_DATA, "custom": custom,
                    "color": {"mode": "palette-classic"}}
        if min_zero:
            defaults["min"] = 0
        self._add({
            "type": "timeseries", "title": title, "datasource": DS,
            **({"description": description} if description else {}),
            "targets": [_target(e, legend=l, ref=chr(65 + i)) for i, (e, l) in enumerate(targets)],
            "fieldConfig": {"defaults": defaults, "overrides": overrides or []},
            "options": {
                "legend": {"displayMode": "table", "placement": "bottom",
                           "calcs": ["lastNotNull", "max"], "showLegend": True},
                "tooltip": {"mode": "multi", "sort": "desc"},
            },
        }, w, h)

    def bars(self, title, expr, legend, unit="short", steps=None, w=12, h=8, description=None):
        self._add({
            "type": "bargauge", "title": title, "datasource": DS,
            **({"description": description} if description else {}),
            "targets": [_target(expr, legend=legend, instant=True)],
            "fieldConfig": {"defaults": {
                "unit": unit, "noValue": NO_DATA, "min": 0,
                "color": {"mode": "thresholds"},
                "thresholds": {"mode": "absolute", "steps": _steps(steps or [(None, BLUE)])},
            }, "overrides": []},
            "options": {"orientation": "horizontal", "displayMode": "basic", "showUnfilled": True,
                        "valueMode": "color", "namePlacement": "left", "sizing": "auto",
                        "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False}},
        }, w, h)

    def write(self):
        self._newline()
        board = {
            "uid": self.uid, "title": self.title, "description": self.description,
            "tags": ["iceforge"], "timezone": "browser", "editable": False,
            "graphTooltip": 1, "refresh": "1m", "schemaVersion": 39, "version": 1,
            "time": {"from": "now-6h", "to": "now"},
            "timepicker": {"refresh_intervals": ["30s", "1m", "5m", "15m"]},
            "templating": {"list": self.variables},
            "links": [{"type": "dashboards", "tags": ["iceforge"], "asDropdown": True,
                       "title": "Tableaux IceForge", "includeVars": False, "keepTime": True}],
            "annotations": {"list": []},
            "panels": self.panels,
        }
        path = OUT / f"{self.uid.removeprefix('iceforge-')}.json"
        path.write_text(json.dumps(board, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"écrit {path.name} ({len(self.panels)} panneaux)")


def _steps(pairs):
    return [{"value": v, "color": c} for v, c in pairs]


def _target(expr, legend="", instant=False, ref="A"):
    target = {"datasource": DS, "expr": expr, "refId": ref, "legendFormat": legend or "__auto"}
    if instant:
        target.update({"instant": True, "range": False})
    return target


def reachable():
    return [{"type": "value", "options": {
        "0": {"text": "Injoignable", "color": RED},
        "1": {"text": "Joignable", "color": GREEN},
    }}]


def alarm():
    return [{"type": "value", "options": {
        "0": {"text": "Aucune", "color": GREEN},
    }}, {"type": "range", "options": {"from": 1, "to": 1e9, "result": {"text": "Active", "color": RED}}}]


def query_var(name, label, query, include_all=True):
    return {
        "type": "query", "name": name, "label": label, "datasource": DS,
        "query": {"query": query, "refId": "var"}, "definition": query,
        "refresh": 2, "sort": 1, "multi": include_all, "includeAll": include_all,
        "current": {"text": "All", "value": "$__all"} if include_all else {},
    }


PCT = [(None, GREEN), (0.75, ORANGE), (0.9, RED)]
CPU_BY_SERVICE = 'sum by (service) (rate(container_cpu_usage_seconds_total{project=~"$project", service=~"$service"}[5m]))'
MEM_BY_SERVICE = 'sum by (service) (container_memory_working_set_bytes{project=~"$project", service=~"$service"})'
CONTAINER_VARS = [
    query_var("project", "Projet", "label_values(container_last_seen, project)"),
    query_var("service", "Service", 'label_values(container_last_seen{project=~"$project"}, service)'),
]


def overview():
    b = Board("iceforge-vue-ensemble", "Vue d'ensemble",
              "État des services, trafic de l'API et ressources de l'hôte.", CONTAINER_VARS)
    b.row("État")
    b.stat("Backend", 'up{job="backend"}', mappings=reachable(), w=4)
    b.stat("RabbitMQ", 'up{job="rabbitmq"}', mappings=reachable(), w=4)
    b.stat("Hôte", 'up{job="node"}', mappings=reachable(), w=4)
    b.stat("Conteneurs", 'up{job="cadvisor"}', mappings=reachable(), w=4)
    b.stat("Messages en attente", 'sum(rabbitmq_detailed_queue_messages_ready)',
           steps=[(None, GREEN), (50, ORANGE), (500, RED)], w=4,
           description="Messages publiés que personne n'a encore lus, toutes files confondues.")
    b.stat("Files sans lecteur", '(count(rabbitmq_detailed_queue_consumers == 0 and on (queue) '
           'rabbitmq_detailed_queue_messages_ready > 0) or vector(0)) and on () up{job="rabbitmq-queues"} == 1',
           steps=[(None, GREEN), (1, RED)], w=4,
           description="Files qui contiennent des messages mais n'ont aucun consommateur, par exemple quand le bot est arrêté.")
    b.row("API")
    b.stat("Requêtes", f'sum(rate(http_server_requests_seconds_count{{{HTTP}}}[5m]))', unit="reqps",
           decimals=2, w=6)
    # Sans 5xx, le numérateur n'a pas de série : 0 mesuré tant que le dénominateur (le trafic) existe.
    b.stat("Erreurs serveur", f'(sum(rate(http_server_requests_seconds_count{{{HTTP}, outcome="SERVER_ERROR"}}[5m])) or vector(0)) '
           f'/ sum(rate(http_server_requests_seconds_count{{{HTTP}}}[5m]))',
           unit="percentunit", steps=[(None, GREEN), (0.01, ORANGE), (0.05, RED)], decimals=2, w=6,
           description="Part des réponses 5xx sur 5 minutes.")
    b.stat("Latence p95", f'histogram_quantile(0.95, sum by (le) (rate(http_server_requests_seconds_bucket{{{HTTP}}}[5m])))',
           unit="s", steps=[(None, GREEN), (0.5, ORANGE), (1.5, RED)], decimals=2, w=6)
    b.stat("Pool PostgreSQL utilisé", 'sum(hikaricp_connections_active) / sum(hikaricp_connections_max)',
           unit="percentunit", steps=PCT, w=6)
    b.series("Requêtes par résultat", [
        (f'sum by (outcome) (rate(http_server_requests_seconds_count{{{HTTP}}}[5m]))', "{{outcome}}"),
    ], unit="reqps", stack=True)
    b.series("Latence de l'API", [
        (f'histogram_quantile(0.5, sum by (le) (rate(http_server_requests_seconds_bucket{{{HTTP}}}[5m])))', "p50"),
        (f'histogram_quantile(0.95, sum by (le) (rate(http_server_requests_seconds_bucket{{{HTTP}}}[5m])))', "p95"),
        (f'histogram_quantile(0.99, sum by (le) (rate(http_server_requests_seconds_bucket{{{HTTP}}}[5m])))', "p99"),
    ], unit="s")
    b.row("Hôte")
    b.stat("CPU", '1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))', unit="percentunit", steps=PCT, w=6)
    b.stat("Mémoire", '1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes',
           unit="percentunit", steps=PCT, w=6)
    b.stat("Disque le plus plein", f'max(1 - node_filesystem_avail_bytes{{{DISKS}}} / node_filesystem_size_bytes{{{DISKS}}})',
           unit="percentunit", steps=[(None, GREEN), (0.8, ORANGE), (0.9, RED)], w=6)
    b.stat("Démarré depuis", 'time() - node_boot_time_seconds', unit="s", w=6)
    b.series("CPU par conteneur", [(CPU_BY_SERVICE, "{{service}}")], unit="percentunit", stack=True,
             description="1 = un cœur entier.")
    b.series("Mémoire par conteneur", [(MEM_BY_SERVICE, "{{service}}")], unit="bytes", stack=True)
    b.write()


def backend():
    b = Board("iceforge-backend", "Backend Spring",
              "API HTTP, JVM, pool PostgreSQL, messagerie RabbitMQ et journaux du backend.")
    b.row("HTTP")
    b.series("Routes les plus appelées", [
        (f'topk(10, sum by (method, uri) (rate(http_server_requests_seconds_count{{{HTTP}}}[5m])))', "{{method}} {{uri}}"),
    ], unit="reqps")
    b.series("Routes les plus lentes (p95)", [
        (f'topk(10, histogram_quantile(0.95, sum by (le, method, uri) (rate(http_server_requests_seconds_bucket{{{HTTP}}}[5m]))))',
         "{{method}} {{uri}}"),
    ], unit="s")
    b.series("Erreurs serveur par route", [
        (f'sum by (method, uri, status) (rate(http_server_requests_seconds_count{{{HTTP}, outcome="SERVER_ERROR"}}[5m])) > 0',
         "{{status}} {{method}} {{uri}}"),
    ], unit="reqps")
    b.series("Refus d'accès et limitation", [
        (f'sum by (status) (rate(http_server_requests_seconds_count{{{HTTP}, status=~"401|403|429"}}[5m]))', "{{status}}"),
    ], unit="reqps", description="401 : jeton absent ou expiré. 403 : rôle insuffisant. 429 : limite de débit atteinte (connexion, recrutement…).")
    b.row("JVM")
    b.stat("Démarré depuis", 'process_uptime_seconds{job="backend"}', unit="s", w=6)
    b.stat("Tas utilisé", 'sum(jvm_memory_used_bytes{job="backend", area="heap"}) / sum(jvm_memory_max_bytes{job="backend", area="heap"})',
           unit="percentunit", steps=PCT, w=6)
    b.stat("CPU du processus", 'process_cpu_usage{job="backend"}', unit="percentunit", steps=PCT, w=6)
    b.stat("Threads", 'jvm_threads_live_threads{job="backend"}', w=6)
    b.series("Mémoire de la JVM", [
        ('sum by (area) (jvm_memory_used_bytes{job="backend"})', "utilisé {{area}}"),
        ('sum(jvm_memory_max_bytes{job="backend", area="heap"})', "maximum heap"),
    ], unit="bytes")
    b.series("Temps passé en GC", [
        ('sum by (gc) (rate(jvm_gc_pause_seconds_sum{job="backend"}[5m]))', "{{gc}}"),
    ], unit="percentunit", description="Part du temps où l'application est suspendue par le ramasse-miettes.")
    b.row("PostgreSQL (pool Hikari)")
    b.series("Connexions", [
        ('sum(hikaricp_connections_active{job="backend"})', "actives"),
        ('sum(hikaricp_connections_idle{job="backend"})', "libres"),
        ('sum(hikaricp_connections_pending{job="backend"})', "en attente"),
        ('sum(hikaricp_connections_max{job="backend"})', "maximum"),
    ], w=12)
    b.series("Attente d'une connexion", [
        ('sum(rate(hikaricp_connections_acquire_seconds_sum{job="backend"}[5m])) / sum(rate(hikaricp_connections_acquire_seconds_count{job="backend"}[5m]))', "moyenne"),
        ('max(hikaricp_connections_acquire_seconds_max{job="backend"})', "maximum"),
    ], unit="s", w=12)
    b.row("Messagerie (client RabbitMQ du backend)")
    b.series("Messages du backend", [
        ('sum(rate(rabbitmq_published_total{job="backend"}[5m]))', "publiés"),
        ('sum(rate(rabbitmq_consumed_total{job="backend"}[5m]))', "consommés"),
        ('sum(rate(rabbitmq_rejected_total{job="backend"}[5m]))', "rejetés"),
        ('sum(rate(rabbitmq_failed_to_publish_total{job="backend"}[5m]))', "échecs de publication"),
    ], unit="cps")
    b.series("Traitement des messages reçus", [
        ('sum by (queue, result) (rate(spring_rabbitmq_listener_seconds_count{job="backend"}[5m]))', "{{queue}} {{result}}"),
    ], unit="cps", description="Messages lus par les écouteurs du backend (participations Discord, liaisons de compte…).")
    b.row("Tâches planifiées et journaux")
    b.series("Exécutions planifiées", [
        ('sum by (code_function, outcome) (increase(tasks_scheduled_execution_seconds_count{job="backend"}[15m]))',
         "{{code_function}} {{outcome}}"),
    ], description="Rappels d'événements, veille CIG, avis de raffinage prêts…")
    b.series("Avertissements et erreurs journalisés", [
        ('sum by (level) (rate(logback_events_total{job="backend", level=~"warn|error"}[5m]))', "{{level}}"),
    ], unit="cps")
    b.write()


def rabbitmq():
    b = Board("iceforge-rabbitmq", "RabbitMQ",
              "Files entre le backend et le bot Discord, débits et ressources du broker.")
    b.row("Broker")
    b.stat("Connexions", 'rabbitmq_connections', w=4)
    b.stat("Consommateurs", 'rabbitmq_consumers', w=4)
    b.stat("Mémoire / limite", 'rabbitmq_process_resident_memory_bytes / rabbitmq_resident_memory_limit_bytes',
           unit="percentunit", steps=PCT, w=4)
    b.stat("Disque libre", 'rabbitmq_disk_space_available_bytes', unit="bytes", w=4)
    b.stat("Alarmes", 'sum(rabbitmq_alarms_memory_used_watermark) + sum(rabbitmq_alarms_free_disk_space_watermark)',
           mappings=alarm(), steps=[(None, GREEN), (1, RED)], w=4,
           description="Une alarme mémoire ou disque bloque toutes les publications.")
    b.stat("Descripteurs de fichiers", 'rabbitmq_process_open_fds / rabbitmq_process_max_fds',
           unit="percentunit", steps=PCT, w=4)
    b.row("Files")
    b.bars("Messages prêts par file", 'sort_desc(sum by (queue) (rabbitmq_detailed_queue_messages_ready))',
           "{{queue}}", steps=[(None, GREEN), (50, ORANGE), (500, RED)], h=10)
    b.bars("Consommateurs par file", 'sort(sum by (queue) (rabbitmq_detailed_queue_consumers))',
           "{{queue}}", steps=[(None, RED), (1, GREEN)], h=10,
           description="Rouge : aucun lecteur. Les files de retry et de lettres mortes n'en ont normalement pas.")
    b.series("Messages prêts", [
        ('sum by (queue) (rabbitmq_detailed_queue_messages_ready) > 0', "{{queue}}"),
    ])
    b.series("Messages en cours de traitement", [
        ('sum by (queue) (rabbitmq_detailed_queue_messages_unacked) > 0', "{{queue}}"),
    ], description="Messages livrés à un consommateur et pas encore acquittés.")
    b.row("Débits")
    b.series("Flux de messages", [
        ('sum(rate(rabbitmq_global_messages_received_total[5m]))', "reçus"),
        ('sum(rate(rabbitmq_global_messages_delivered_total[5m]))', "livrés"),
        ('sum(rate(rabbitmq_global_messages_acknowledged_total[5m]))', "acquittés"),
        ('sum(rate(rabbitmq_global_messages_redelivered_total[5m]))', "relivrés"),
    ], unit="cps")
    b.series("Messages perdus ou écartés", [
        ('sum(rate(rabbitmq_global_messages_unroutable_dropped_total[5m]))', "non routables (abandonnés)"),
        ('sum(rate(rabbitmq_global_messages_unroutable_returned_total[5m]))', "non routables (renvoyés)"),
        ('sum(rate(rabbitmq_global_messages_dead_lettered_rejected_total[5m]))', "lettres mortes : rejet"),
        ('sum(rate(rabbitmq_global_messages_dead_lettered_expired_total[5m]))', "lettres mortes : expiration"),
        ('sum(rate(rabbitmq_global_messages_dead_lettered_maxlen_total[5m]))', "lettres mortes : file pleine"),
        ('sum(rate(rabbitmq_global_messages_dead_lettered_delivery_limit_total[5m]))', "lettres mortes : trop de tentatives"),
    ], unit="cps", description="Un message non routable n'atteint aucune file : le bot ou le backend ne le verra jamais.")
    b.series("Connexions et canaux", [
        ('rabbitmq_connections', "connexions"),
        ('rabbitmq_channels', "canaux"),
        ('sum(rate(rabbitmq_connections_opened_total[5m])) * 300', "connexions ouvertes / 5 min"),
    ])
    b.series("Mémoire du broker", [
        ('rabbitmq_process_resident_memory_bytes', "utilisée"),
        ('rabbitmq_resident_memory_limit_bytes', "limite"),
    ], unit="bytes")
    b.write()


def host():
    b = Board("iceforge-hote", "Hôte et conteneurs",
              "Ressources du serveur (node-exporter) et de chaque conteneur (cAdvisor).", CONTAINER_VARS)
    b.row("Serveur")
    b.series("CPU", [
        ('sum by (mode) (rate(node_cpu_seconds_total{mode!="idle"}[5m])) / scalar(count(node_cpu_seconds_total{mode="idle"}))', "{{mode}}"),
    ], unit="percentunit", stack=True)
    b.series("Charge", [
        ('node_load1', "1 min"), ('node_load5', "5 min"), ('node_load15', "15 min"),
        ('count(node_cpu_seconds_total{mode="idle"})', "cœurs"),
    ])
    b.series("Mémoire", [
        ('node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes', "utilisée"),
        ('node_memory_MemAvailable_bytes', "disponible"),
        ('node_memory_SwapTotal_bytes - node_memory_SwapFree_bytes', "swap utilisé"),
    ], unit="bytes")
    b.bars("Occupation des disques",
           f'1 - node_filesystem_avail_bytes{{{DISKS}}} / node_filesystem_size_bytes{{{DISKS}}}',
           "{{mountpoint}}", unit="percentunit", steps=[(None, GREEN), (0.8, ORANGE), (0.9, RED)])
    b.series("Lectures et écritures disque", [
        ('sum(rate(node_disk_read_bytes_total[5m]))', "lecture"),
        ('sum(rate(node_disk_written_bytes_total[5m]))', "écriture"),
    ], unit="Bps")
    b.series("Attente des entrées-sorties", [
        ('avg(rate(node_cpu_seconds_total{mode="iowait"}[5m]))', "iowait"),
    ], unit="percentunit", description="Temps CPU passé à attendre le disque : élevé pendant les sauvegardes ou un disque saturé.")
    b.row("Conteneurs")
    b.series("CPU", [(CPU_BY_SERVICE, "{{service}}")], unit="percentunit", description="1 = un cœur entier.")
    b.series("Bridage CPU", [
        ('sum by (service) (rate(container_cpu_cfs_throttled_periods_total{project=~"$project", service=~"$service"}[5m])) '
         '/ sum by (service) (rate(container_cpu_cfs_periods_total{project=~"$project", service=~"$service"}[5m]))', "{{service}}"),
    ], unit="percentunit", description="Part des périodes où le conteneur a atteint sa limite « cpus » de Compose.")
    b.series("Mémoire", [(MEM_BY_SERVICE, "{{service}}")], unit="bytes")
    b.series("Mémoire / limite", [
        ('sum by (service) (container_memory_working_set_bytes{project=~"$project", service=~"$service"}) '
         '/ sum by (service) (container_spec_memory_limit_bytes{project=~"$project", service=~"$service"} > 0)', "{{service}}"),
    ], unit="percentunit", description="Seuls les conteneurs avec un « mem_limit » apparaissent. Proche de 100 % : risque d'arrêt par manque de mémoire.")
    b.series("Réseau reçu", [
        ('sum by (service) (rate(container_network_receive_bytes_total{project=~"$project", service=~"$service"}[5m]))', "{{service}}"),
    ], unit="Bps")
    b.series("Réseau émis", [
        ('sum by (service) (rate(container_network_transmit_bytes_total{project=~"$project", service=~"$service"}[5m]))', "{{service}}"),
    ], unit="Bps")
    b.series("Arrêts pour manque de mémoire", [
        ('sum by (service) (increase(container_oom_events_total{project=~"$project", service=~"$service"}[1h])) > 0', "{{service}}"),
    ])
    b.series("Écritures disque", [
        ('sum by (service) (rate(container_fs_writes_bytes_total{project=~"$project", service=~"$service"}[5m]))', "{{service}}"),
    ], unit="Bps")
    b.write()


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for build in (overview, backend, rabbitmq, host):
        build()
