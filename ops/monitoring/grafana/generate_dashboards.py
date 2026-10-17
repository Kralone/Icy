"""Génère les tableaux de bord Grafana d'IceForge dans grafana/dashboards/.

Les JSON produits sont versionnés et provisionnés en lecture seule : modifier ce script,
le relancer (python ops/monitoring/grafana/generate_dashboards.py), puis committer les deux.
"""

import json
from pathlib import Path

OUT = Path(__file__).resolve().parent / "dashboards"
DS = {"type": "prometheus", "uid": "prometheus"}
PG = {"type": "grafana-postgresql-datasource", "uid": "postgres"}
NO_DATA = "Pas de donnée"


class Sql(str):
    """Requête SQL brute pour la source PostgreSQL ; une chaîne simple reste du PromQL."""

    def __new__(cls, sql, fmt="table"):
        query = super().__new__(cls, sql.strip().replace("mining_fees", MINING_FEES))
        query.fmt = fmt
        return query


def ts(sql):
    """Requête SQL qui renvoie une série temporelle (colonnes time, metric, value)."""
    return Sql(sql, "time_series")

# Couleurs de statut : vert = normal, orange = à surveiller, rouge = action.
GREEN, ORANGE, RED, BLUE = "green", "orange", "red", "blue"

# Requêtes applicatives : le WebSocket (connexions longues) et l'actuator faussent latence et débit.
HTTP = 'job="backend", uri!~"/ws.*|/actuator.*"'
# Systèmes de fichiers sur disque : écarte tmpfs, overlay Docker et lecteurs Windows montés sous WSL.
DISKS = 'fstype=~"ext[234]|xfs|btrfs"'


class Board:
    def __init__(self, uid, title, description, variables=(), time_from="now-6h", refresh="1m",
                 time_to="now", kind="technique"):
        self.uid, self.title, self.description = uid, title, description
        self.time_from, self.time_to, self.refresh = time_from, time_to, refresh
        self.variables = list(variables)
        self.panels, self.y, self.x, self.row_h = [], 0, 0, 0
        self.next_id = 1
        self.kind = kind

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
            "type": "stat", "title": title, "datasource": _ds(expr),
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
               description=None, overrides=None, bars=False):
        custom = {
            "drawStyle": "bars" if bars else "line", "lineWidth": 1 if bars else 2,
            "fillOpacity": 80 if bars else (15 if stack else 5), "barAlignment": -1,
            "showPoints": "never", "spanNulls": False,
            "stacking": {"mode": "normal" if stack else "none", "group": "A"},
        }
        defaults = {"unit": unit, "noValue": NO_DATA, "custom": custom,
                    "color": {"mode": "palette-classic"}}
        if min_zero:
            defaults["min"] = 0
        self._add({
            "type": "timeseries", "title": title, "datasource": _ds(targets[0][0]),
            **({"description": description} if description else {}),
            "targets": [_target(e, legend=l, ref=_ref(i)) for i, (e, l) in enumerate(targets)],
            "fieldConfig": {"defaults": defaults, "overrides": overrides or []},
            "options": {
                "legend": {"displayMode": "table", "placement": "bottom",
                           "calcs": ["lastNotNull", "max"], "showLegend": True},
                "tooltip": {"mode": "multi", "sort": "desc"},
            },
        }, w, h)

    def bars(self, title, expr, legend, unit="short", steps=None, w=12, h=8, description=None):
        """expr : une requête, ou une liste de (PromQL, légende) pour une barre par requête."""
        pairs = expr if isinstance(expr, list) else [(expr, legend)]
        expr = pairs[0][0]
        self._add({
            "type": "bargauge", "title": title, "datasource": _ds(expr),
            **({"description": description} if description else {}),
            "targets": [_target(e, legend=l, instant=True, ref=_ref(i)) for i, (e, l) in enumerate(pairs)],
            "fieldConfig": {"defaults": {
                "unit": unit, "noValue": NO_DATA, "min": 0,
                "color": {"mode": "thresholds"},
                "thresholds": {"mode": "absolute", "steps": _steps(steps or [(None, BLUE)])},
            }, "overrides": []},
            "options": {"orientation": "horizontal", "displayMode": "basic", "showUnfilled": True,
                        "valueMode": "color", "namePlacement": "top", "sizing": "manual",
                        "minVizHeight": 14, "maxVizHeight": 22, "minVizWidth": 8,
                        "text": {"titleSize": 13, "valueSize": 16},
                        # Une ligne SQL par barre ; en PromQL, une série par barre.
                        "reduceOptions": {"calcs": ["lastNotNull"], "fields": "",
                                          "values": isinstance(expr, Sql)}},
        }, w, h)

    def table(self, title, sql, w=24, h=9, columns=None, description=None):
        """columns : {colonne: {"unit": ..., "steps": [...], "width": ...}} pour les colonnes à mettre en forme."""
        overrides = []
        for name, cfg in (columns or {}).items():
            props = []
            if "unit" in cfg:
                props.append({"id": "unit", "value": cfg["unit"]})
            if "decimals" in cfg:
                props.append({"id": "decimals", "value": cfg["decimals"]})
            if "width" in cfg:
                props.append({"id": "custom.width", "value": cfg["width"]})
            if "steps" in cfg:
                props += [{"id": "thresholds", "value": {"mode": "absolute", "steps": _steps(cfg["steps"])}},
                          {"id": "custom.cellOptions", "value": {"type": "color-text"}}]
            if "mappings" in cfg:
                props.append({"id": "mappings", "value": cfg["mappings"]})
            overrides.append({"matcher": {"id": "byName", "options": name}, "properties": props})
        self._add({
            "type": "table", "title": title, "datasource": PG,
            **({"description": description} if description else {}),
            "targets": [_target(sql)],
            "fieldConfig": {"defaults": {"noValue": NO_DATA, "custom": {"align": "auto", "filterable": False}},
                            "overrides": overrides},
            "options": {"showHeader": True, "cellHeight": "sm", "footer": {"show": False}},
        }, w, h)

    def write(self):
        self._newline()
        board = {
            "uid": self.uid, "title": self.title, "description": self.description,
            "tags": ["iceforge", self.kind], "timezone": "browser", "editable": False,
            "graphTooltip": 1, "refresh": self.refresh, "schemaVersion": 39, "version": 1,
            "time": {"from": self.time_from, "to": self.time_to},
            "timepicker": {"refresh_intervals": ["30s", "1m", "5m", "15m", "1h"]},
            "templating": {"list": self.variables},
            "links": [{"type": "dashboards", "tags": ["iceforge", "metier"], "asDropdown": True,
                       "title": "Tableaux métier", "includeVars": False, "keepTime": False},
                      {"type": "dashboards", "tags": ["iceforge", "technique"], "asDropdown": True,
                       "title": "Tableaux techniques", "includeVars": False, "keepTime": False}],
            "annotations": {"list": []},
            "panels": self.panels,
        }
        # Un dossier par type : Grafana en fait les dossiers « Métier » et « Technique ».
        path = OUT / self.kind / f"{self.uid.removeprefix('iceforge-')}.json"
        path.parent.mkdir(exist_ok=True)
        path.write_text(json.dumps(board, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"écrit {self.kind}/{path.name} ({len(self.panels)} panneaux)")


def _steps(pairs):
    return [{"value": v, "color": c} for v, c in pairs]


def _ref(i):
    """A…Z puis AA, AB… : un panneau peut porter plus de 26 requêtes."""
    return chr(65 + i) if i < 26 else chr(64 + i // 26) + chr(65 + i % 26)


def _ds(expr):
    return PG if isinstance(expr, Sql) else DS


def _target(expr, legend="", instant=False, ref="A"):
    if isinstance(expr, Sql):
        return {"datasource": PG, "refId": ref, "rawSql": str(expr), "format": expr.fmt,
                "rawQuery": True, "editorMode": "code"}
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


# --- Tableaux métier (PostgreSQL, rôle iceforge_grafana) -----------------------------------------
# Les dates sont des « timestamp without time zone » écrits par le backend : on les compare à
# localtimestamp. Les montants sont en aUEC, entiers.

AUEC = "suffix: aUEC"
# Frais d'une fiche (docs/mining-v3/SPEC.md) : les frais saisis plus le coût de chaque ordre de raffinage,
# avancé par le lanceur de l'ordre. Écrire « mining_fees » dans une requête insère cette sous-requête.
MINING_FEES = """(SELECT sheet_id, payer_user_id, kind, amount FROM session.expenses
       UNION ALL SELECT sheet_id, launcher_user_id, 'REFINING', cost FROM mining.refinery_orders WHERE cost > 0)"""
SCU = "suffix: SCU"
PRESENT, MAYBE, ABSENT = 1, 0, -1
# Les opérations n'ont pas de type d'événement : on les nomme par leur nature.
EVENT_TYPE = "coalesce(e.event_type, CASE e.activity_type WHEN 'OPERATION' THEN 'Opération' ELSE 'Sans type' END)"


def community():
    b = Board("iceforge-communaute", "Communauté",
              "Membres, activité, candidatures et flottes déclarées.",
              time_from="now-1y", refresh="5m", kind="metier")
    b.row("Membres")
    b.stat("Comptes actifs", Sql("SELECT count(*) FROM core.users WHERE active"), w=4)
    b.stat("Vus sur 7 jours", Sql(
        "SELECT count(*) FROM core.users WHERE active AND last_seen_at >= localtimestamp - interval '7 days'"), w=4,
        description="Comptes actifs avec une activité enregistrée (connexion ou action) dans les 7 derniers jours.")
    b.stat("Vus sur 30 jours", Sql(
        "SELECT count(*) FROM core.users WHERE active AND last_seen_at >= localtimestamp - interval '30 days'"), w=4)
    b.stat("Sans activité depuis 30 jours", Sql(
        "SELECT count(*) FROM core.users WHERE active AND (last_seen_at IS NULL OR last_seen_at < localtimestamp - interval '30 days')"),
        steps=[(None, GREEN), (1, ORANGE)], w=4)
    b.stat("Nouveaux sur la période", Sql("SELECT count(*) FROM core.users WHERE $__timeFilter(created_at)"), w=4)
    b.stat("Notifications push activées", Sql("SELECT count(DISTINCT user_id) FROM core.notification_subscriptions"), w=4,
           description="Membres ayant au moins un appareil abonné aux notifications.")
    b.series("Inscriptions par semaine", [(ts('''
        SELECT date_trunc('week', created_at) AS time, count(*) AS "Inscriptions"
        FROM core.users WHERE $__timeFilter(created_at) GROUP BY 1 ORDER BY 1'''), "")], bars=True)
    b.series("Membres inscrits (cumul)", [(ts('''
        SELECT day AS time, (SELECT count(*) FROM core.users u WHERE u.created_at < day + interval '1 day') AS "Membres"
        FROM generate_series(date_trunc('day', $__timeFrom()::timestamp), localtimestamp, interval '1 day') AS day
        ORDER BY 1'''), "")], min_zero=False,
        description="Comptes créés à chaque date, désactivés compris : la base ne date pas les désactivations.")
    b.bars("Rôles", Sql('''
        SELECT r.name AS metric, count(*) AS value FROM core.user_roles ur
        JOIN core.roles r ON r.id = ur.role_id JOIN core.users u ON u.id = ur.user_id
        WHERE u.active GROUP BY 1 ORDER BY 2 DESC'''), "", w=8)
    b.bars("Présence affichée", Sql('''
        SELECT CASE status WHEN 'CONNECTE' THEN 'Connecté' WHEN 'ABSENT' THEN 'Absent'
                           WHEN 'HORS_LIGNE' THEN 'Hors ligne' ELSE status END AS metric, count(*) AS value
        FROM core.users WHERE active GROUP BY status ORDER BY 2 DESC'''), "", w=8)
    b.bars("Collections remplies", Sql('''
        SELECT 'Membres avec une collection' AS metric, count(DISTINCT user_id) AS value FROM collections.user_collection
        UNION ALL SELECT 'Collections', count(*) FROM collections.user_collection'''), "", w=8)
    b.row("Recrutement")
    b.stat("Candidatures en attente", Sql("SELECT count(*) FROM recruitment.recruitment WHERE status = 'PENDING'"),
           steps=[(None, GREEN), (1, ORANGE)], w=6)
    b.stat("Candidatures sur la période", Sql("SELECT count(*) FROM recruitment.recruitment WHERE $__timeFilter(created_at)"), w=6)
    b.stat("Acceptées sur la période", Sql('''
        SELECT round(count(*) FILTER (WHERE status = 'APPROVED')::numeric / nullif(count(*) FILTER (WHERE status <> 'PENDING'), 0), 3)
        FROM recruitment.recruitment WHERE $__timeFilter(created_at)'''), unit="percentunit", w=6,
        description="Part des candidatures traitées (hors attente) qui ont été acceptées.")
    b.stat("Délai depuis la plus ancienne en attente", Sql('''
        SELECT extract(epoch FROM now() - min(created_at)) FROM recruitment.recruitment WHERE status = 'PENDING' '''),
        unit="s", steps=[(None, GREEN), (3 * 86400, ORANGE), (7 * 86400, RED)], w=6)
    b.series("Candidatures par semaine", [(ts('''
        SELECT date_trunc('week', created_at) AS time,
               CASE status WHEN 'PENDING' THEN 'En attente' WHEN 'APPROVED' THEN 'Acceptée'
                           WHEN 'REFUSED' THEN 'Refusée' WHEN 'CANCELLED' THEN 'Annulée' ELSE status END AS metric,
               count(*) AS value
        FROM recruitment.recruitment WHERE $__timeFilter(created_at) GROUP BY 1, 2 ORDER BY 1'''), "")],
        bars=True, stack=True)
    b.bars("Gameplay recherché par les candidats", Sql('''
        SELECT coalesce(nullif(btrim(preferred_gameplay), ''), 'Non précisé') AS metric, count(*) AS value
        FROM recruitment.recruitment WHERE $__timeFilter(created_at) GROUP BY 1 ORDER BY 2 DESC LIMIT 10'''), "")
    b.row("Flottes déclarées")
    b.stat("Vaisseaux déclarés", Sql("SELECT count(*) FROM fleet.user_ships"), w=6)
    b.stat("Membres avec une flotte", Sql("SELECT count(DISTINCT user_id) FROM fleet.user_ships"), w=6)
    b.stat("Achetés en jeu", Sql('''
        SELECT round(count(*) FILTER (WHERE in_game_purchase)::numeric / nullif(count(*), 0), 3) FROM fleet.user_ships'''),
        unit="percentunit", w=6)
    b.stat("Prêts (loaners)", Sql("SELECT count(*) FILTER (WHERE loaner) FROM fleet.user_ships"), w=6)
    b.bars("Vaisseaux les plus possédés", Sql('''
        SELECT coalesce(s.name, 'Vaisseau n°' || us.ship_id) AS metric, count(*) AS value
        FROM fleet.user_ships us LEFT JOIN catalog.ship_compat s ON s.id = us.ship_id
        GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 15'''), "", h=10)
    b.bars("Rôles des vaisseaux", Sql('''
        SELECT coalesce(nullif(s.focus, ''), 'Rôle non renseigné') AS metric, count(*) AS value
        FROM fleet.user_ships us LEFT JOIN catalog.ship_compat s ON s.id = us.ship_id
        GROUP BY 1 ORDER BY 2 DESC LIMIT 15'''), "", h=10)
    b.stat("Membres avec un vaisseau exécutif", Sql(
        "SELECT count(*) FROM utils.exec_hangar_player_status WHERE has_exec_ship"), w=8,
        description="Déclarés dans l'outil Hangar exécutif.")
    b.stat("Comptes en attente d'un nouveau mot de passe", Sql(
        "SELECT count(*) FROM core.users WHERE active AND pwd_reset"), steps=[(None, GREEN), (1, ORANGE)], w=8,
        description="Comptes créés ou réinitialisés par un administrateur, dont le mot de passe provisoire n'a pas été changé.")
    b.stat("Membres ayant coupé toutes les notifications", Sql(
        "SELECT count(*) FROM core.user_params p JOIN core.users u ON u.id = p.user_id WHERE u.active AND NOT p.notif_global"),
        w=8)
    b.row("Connexions")
    b.series("Membres connectés par jour", [(ts('''
        SELECT date_trunc('day', created_at) AS time, count(DISTINCT user_id) AS "Membres connectés"
        FROM core.refresh_tokens WHERE $__timeFilter(created_at) GROUP BY 1 ORDER BY 1'''), "")], bars=True,
        description="Membres ayant ouvert ou prolongé une session ce jour-là (jetons de session émis).")
    b.series("Membres connectés par semaine", [(ts('''
        SELECT date_trunc('week', created_at) AS time, count(DISTINCT user_id) AS "Membres connectés"
        FROM core.refresh_tokens WHERE $__timeFilter(created_at) GROUP BY 1 ORDER BY 1'''), "")], bars=True)
    b.bars("Heures de connexion (heure de Paris)", Sql('''
        SELECT lpad(extract(hour FROM created_at AT TIME ZONE 'Europe/Paris')::text, 2, '0') || ' h' AS metric,
               count(DISTINCT (user_id, (created_at AT TIME ZONE 'Europe/Paris')::date)) AS value
        FROM core.refresh_tokens WHERE $__timeFilter(created_at) GROUP BY 1 ORDER BY 1'''), "", h=14,
        description="Pour chaque heure de la journée : nombre de fois où un membre était connecté (un membre compte une fois par jour). "
                    "Utile pour choisir l'horaire des événements.")
    b.bars("Préférences de notification", Sql('''
        SELECT label AS metric, count(*) FILTER (WHERE on_) AS value FROM core.user_params p
        JOIN core.users u ON u.id = p.user_id AND u.active
        CROSS JOIN LATERAL (VALUES ('Toutes', p.notif_global), ('Événements', p.notif_events), ('Flotte', p.notif_fleet),
                                   ('Objectifs', p.notif_goals), ('Discord', p.notif_discord)) AS v(label, on_)
        GROUP BY label ORDER BY 2 DESC'''), "", description="Membres actifs ayant laissé chaque type de notification activé.")
    b.write()


def events():
    b = Board("iceforge-evenements", "Événements et opérations",
              "Calendrier, réponses des membres, opérations, objectifs et événements Star Citizen.",
              time_from="now-6M", time_to="now+2M", refresh="5m", kind="metier")
    b.row("Événements")
    b.stat("À venir", Sql("SELECT count(*) FROM events.events WHERE start_date_time > localtimestamp AND NOT finished"), w=4)
    b.stat("Sur la période", Sql("SELECT count(*) FROM events.events WHERE $__timeFilter(start_date_time)"), w=4)
    b.stat("Réponses « présent »", Sql(f'''
        SELECT count(*) FROM events.event_participation p JOIN events.events e ON e.id = p.event_id
        WHERE p.status = {PRESENT} AND $__timeFilter(e.start_date_time)'''), w=4)
    b.stat("Présents par événement", Sql(f'''
        SELECT round(count(p.id) FILTER (WHERE p.status = {PRESENT})::numeric / nullif(count(DISTINCT e.id), 0), 1)
        FROM events.events e LEFT JOIN events.event_participation p ON p.event_id = e.id
        WHERE $__timeFilter(e.start_date_time) AND e.start_date_time <= localtimestamp'''), decimals=1, w=4,
        description="Moyenne des réponses « présent » par événement passé de la période. C'est une intention, pas une présence vérifiée.")
    b.stat("Opérations publiées", Sql('''
        SELECT count(*) FROM events.operations o JOIN events.events e ON e.id = o.event_id
        WHERE o.publication_status = 'PUBLISHED' AND $__timeFilter(e.start_date_time)'''), w=4)
    b.stat("Opérations en brouillon", Sql('''
        SELECT count(*) FROM events.operations o JOIN events.events e ON e.id = o.event_id
        WHERE o.publication_status = 'DRAFT' AND e.start_date_time > localtimestamp'''),
        steps=[(None, GREEN), (1, ORANGE)], w=4, description="Opérations à venir pas encore publiées.")
    b.table("Prochains événements", Sql(f'''
        SELECT e.start_date_time AS "Début", e.title AS "Titre", {EVENT_TYPE} AS "Type",
               CASE WHEN o.event_id IS NULL THEN 'Événement'
                    WHEN o.publication_status = 'DRAFT' THEN 'Opération (brouillon)' ELSE 'Opération' END AS "Nature",
               count(p.id) FILTER (WHERE p.status = {PRESENT}) AS "Présents",
               count(p.id) FILTER (WHERE p.status = {MAYBE}) AS "Peut-être",
               count(p.id) FILTER (WHERE p.status = {ABSENT}) AS "Absents",
               (SELECT count(*) FROM events.operation_assignments a
                 WHERE a.operation_event_id = e.id AND a.status = 'CONFIRMED') AS "Affectés"
        FROM events.events e
        LEFT JOIN events.operations o ON o.event_id = e.id
        LEFT JOIN events.event_participation p ON p.event_id = e.id
        WHERE e.start_date_time > localtimestamp AND NOT e.finished
        GROUP BY e.id, o.event_id, o.publication_status ORDER BY e.start_date_time LIMIT 20'''),
        columns={"Début": {"unit": "dateTimeAsLocal", "width": 170}, "Présents": {"width": 90},
                 "Peut-être": {"width": 90}, "Absents": {"width": 90}, "Affectés": {"width": 90}},
        description="Affectés : membres placés dans un groupe de l'opération (vide pour un événement simple).")
    b.series("Événements par mois", [(ts(f'''
        SELECT date_trunc('month', e.start_date_time) AS time, {EVENT_TYPE} AS metric, count(*) AS value
        FROM events.events e WHERE $__timeFilter(e.start_date_time) GROUP BY 1, 2 ORDER BY 1'''), "")],
        bars=True, stack=True)
    b.series("Réponses par mois", [(ts(f'''
        SELECT date_trunc('month', e.start_date_time) AS time,
               CASE p.status WHEN {PRESENT} THEN 'Présent' WHEN {MAYBE} THEN 'Peut-être' ELSE 'Absent' END AS metric,
               count(*) AS value
        FROM events.event_participation p JOIN events.events e ON e.id = p.event_id
        WHERE $__timeFilter(e.start_date_time) GROUP BY 1, 2 ORDER BY 1'''), "")], bars=True, stack=True,
        description="Rattachées au mois de l'événement : la base ne date pas les réponses.")
    b.bars("Membres les plus présents", Sql(f'''
        SELECT u.username AS metric, count(*) AS value
        FROM events.event_participation p JOIN events.events e ON e.id = p.event_id JOIN core.users u ON u.id = p.user_id
        WHERE p.status = {PRESENT} AND $__timeFilter(e.start_date_time) AND e.start_date_time <= localtimestamp
        GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10'''), "", h=10)
    b.bars("Événements par type", Sql(f'''
        SELECT {EVENT_TYPE} AS metric, count(*) AS value FROM events.events e
        WHERE $__timeFilter(e.start_date_time) GROUP BY 1 ORDER BY 2 DESC'''), "", h=10)
    b.row("Opérations")
    b.table("Opérations de la période", Sql('''
        SELECT e.start_date_time AS "Début", e.title AS "Opération",
               CASE o.publication_status WHEN 'DRAFT' THEN 'Brouillon' ELSE 'Publiée' END AS "Statut",
               (SELECT count(*) FROM events.operation_groups g WHERE g.operation_event_id = e.id) AS "Groupes",
               (SELECT count(*) FROM events.operation_assignments a
                 WHERE a.operation_event_id = e.id AND a.status = 'CONFIRMED') AS "Affectés",
               (SELECT count(*) FROM events.operation_assignments a
                 WHERE a.operation_event_id = e.id AND a.status = 'PENDING') AS "En attente",
               (SELECT CASE WHEN count(*) = count(capacity) THEN sum(capacity) END
                  FROM events.operation_groups g WHERE g.operation_event_id = e.id) AS "Places",
               (SELECT coalesce(sum(quantity), 0) FROM events.operation_ship_requirements r
                 WHERE r.operation_event_id = e.id AND r.status <> 'CANCELLED') AS "Vaisseaux demandés",
               (SELECT count(*) FROM events.operation_ship_proposals sp
                 WHERE sp.operation_event_id = e.id AND sp.status = 'ACCEPTED') AS "Vaisseaux acceptés"
        FROM events.operations o JOIN events.events e ON e.id = o.event_id
        WHERE $__timeFilter(e.start_date_time) ORDER BY e.start_date_time DESC LIMIT 30'''),
        columns={"Début": {"unit": "dateTimeAsLocal", "width": 170}},
        description="Places : somme des capacités des groupes, vide si un groupe n'a pas de capacité définie.")
    b.stat("Demandes d'affectation en attente", Sql('''
        SELECT count(*) FROM events.operation_assignment_requests r JOIN events.events e ON e.id = r.operation_event_id
        WHERE r.status = 'PENDING' AND e.start_date_time > localtimestamp'''), steps=[(None, GREEN), (1, ORANGE)], w=6,
        description="Membres qui demandent une place dans un groupe à validation : un responsable doit répondre.")
    b.stat("Vaisseaux proposés en attente", Sql('''
        SELECT count(*) FROM events.operation_ship_proposals p JOIN events.events e ON e.id = p.operation_event_id
        WHERE p.status = 'PROPOSED' AND e.start_date_time > localtimestamp'''), steps=[(None, GREEN), (1, ORANGE)], w=6)
    b.stat("Événements publiés sur Discord", Sql('''
        SELECT round(count(*) FILTER (WHERE discord_message_id IS NOT NULL)::numeric / nullif(count(*), 0), 3)
        FROM events.events WHERE $__timeFilter(start_date_time)'''), unit="percentunit",
        steps=[(None, RED), (0.8, ORANGE), (0.95, GREEN)], w=6,
        description="Part des événements de la période dont le message Discord existe. Un écart signale un message perdu par le bot.")
    b.stat("Modèles d'équipage utilisés", Sql('''
        SELECT count(DISTINCT g.crew_preset_id) || ' / ' || (SELECT count(*) FROM events.operation_crew_presets WHERE NOT archived)
        FROM events.operation_groups g WHERE g.crew_preset_id IS NOT NULL'''), w=6,
        description="Modèles d'équipage appliqués au moins une fois, sur les modèles non archivés.")
    b.bars("Réponses aux demandes d'affectation", Sql('''
        SELECT CASE r.status WHEN 'PENDING' THEN 'En attente' WHEN 'APPROVED' THEN 'Acceptée' WHEN 'REFUSED' THEN 'Refusée'
                             WHEN 'CANCELLED' THEN 'Annulée' ELSE r.status END AS metric, count(*) AS value
        FROM events.operation_assignment_requests r JOIN events.events e ON e.id = r.operation_event_id
        WHERE $__timeFilter(e.start_date_time) GROUP BY 1 ORDER BY 2 DESC'''), "", w=12)
    b.bars("Vaisseaux proposés aux opérations", Sql('''
        SELECT CASE p.status WHEN 'PROPOSED' THEN 'Proposé' WHEN 'ACCEPTED' THEN 'Accepté' WHEN 'DECLINED' THEN 'Refusé'
                             WHEN 'UNAVAILABLE' THEN 'Indisponible' ELSE p.status END AS metric, count(*) AS value
        FROM events.operation_ship_proposals p JOIN events.events e ON e.id = p.operation_event_id
        WHERE $__timeFilter(e.start_date_time) GROUP BY 1 ORDER BY 2 DESC'''), "", w=12)
    b.row("Objectifs")
    b.table("Objectifs en cours", Sql('''
        SELECT g.name AS "Objectif", coalesce(u.username, 'Organisation') AS "Porteur",
               g.current AS "Atteint", g.target AS "Cible",
               round(g.current::numeric / nullif(g.target, 0), 3) AS "Avancement",
               g.created_at AS "Créé le"
        FROM goals.goals g LEFT JOIN core.users u ON u.id = g.user_id
        WHERE NOT g.completed ORDER BY g.pinned DESC, 5 DESC NULLS LAST LIMIT 20'''),
        columns={"Avancement": {"unit": "percentunit", "steps": [(None, ORANGE), (0.5, BLUE), (1, GREEN)], "width": 120},
                 "Créé le": {"unit": "dateTimeAsLocal", "width": 170}}, w=14)
    b.series("Contributions aux objectifs par semaine", [(ts('''
        SELECT date_trunc('week', created_at) AS time, count(*) AS "Contributions"
        FROM goals.goal_participations WHERE $__timeFilter(created_at) GROUP BY 1 ORDER BY 1'''), "")],
        bars=True, w=10, h=9)
    b.row("Événements Star Citizen")
    b.table("Participation aux événements Star Citizen", Sql(f'''
        SELECT w.start_at AS "Début", w.title AS "Événement", w.type_name AS "Type",
               count(p.id) FILTER (WHERE p.status = {PRESENT}) AS "Confirmés",
               count(p.id) FILTER (WHERE p.status = {MAYBE}) AS "Peut-être",
               coalesce(sum(p.total) FILTER (WHERE p.status = {PRESENT}), 0) AS "Points des confirmés"
        FROM scworld.sc_world_event w LEFT JOIN scworld.sc_world_event_participation p ON p.scwe_id = w.id
        WHERE $__timeFilter(w.start_at) GROUP BY w.id ORDER BY w.start_at DESC LIMIT 20'''),
        columns={"Début": {"unit": "dateTimeAsLocal", "width": 170}}, h=7)
    b.write()


# Règlement en cours d'une fiche : le seul non annulé (index unique session_settlements_one_current).
CURRENT_SETTLEMENT = "s.cancelled_at IS NULL"


def mining():
    b = Board("iceforge-minage", "Minage",
              "Fiches de minage : ventes, frais avancés, partage, virements entre participants et raffinage.",
              time_from="now-6M", refresh="5m", kind="metier")
    b.row("Période")
    b.stat("Fiches", Sql("SELECT count(*) FROM session.sheets WHERE $__timeFilter(session_date)"), w=4)
    b.stat("Ventes", Sql('''
        SELECT sum(sa.amount) FROM session.sales sa JOIN session.sheets sh ON sh.id = sa.sheet_id
        WHERE $__timeFilter(sh.session_date)'''), unit=AUEC, w=5)
    b.stat("Frais avancés", Sql('''
        SELECT sum(ex.amount) FROM mining_fees ex JOIN session.sheets sh ON sh.id = ex.sheet_id
        WHERE $__timeFilter(sh.session_date)'''), unit=AUEC, steps=[(None, ORANGE)], w=5,
        description="Raffinage, carburant, réparations, matériel… payés par un participant pour le groupe. Ils lui sont remboursés au partage.")
    b.stat("Bénéfice net", Sql('''
        SELECT (SELECT sum(sa.amount) FROM session.sales sa JOIN session.sheets sh ON sh.id = sa.sheet_id
                 WHERE $__timeFilter(sh.session_date))
             - coalesce((SELECT sum(ex.amount) FROM mining_fees ex JOIN session.sheets sh ON sh.id = ex.sheet_id
                 WHERE $__timeFilter(sh.session_date)), 0)'''), unit=AUEC,
        steps=[(None, RED), (0, GREEN)], w=5, description="Ventes moins frais avancés. Sans vente, pas de valeur.")
    b.stat("Participations", Sql('''
        SELECT count(*) FROM session.participants pa JOIN session.sheets sh ON sh.id = pa.sheet_id
        WHERE $__timeFilter(sh.session_date)'''), w=5, description="Somme des participants de chaque fiche.")
    b.row("À traiter")
    b.stat("Fiches en cours", Sql("SELECT count(*) FROM session.sheets WHERE status = 'ACTIVE'"), w=4)
    b.stat("Fiches en règlement", Sql("SELECT count(*) FROM session.sheets WHERE status = 'SETTLEMENT'"),
           steps=[(None, GREEN), (1, ORANGE)], w=5, description="Comptes arrêtés, virements pas encore tous confirmés.")
    b.stat("Virements en attente", Sql(f'''
        SELECT count(*) FROM session.settlement_transfers t JOIN session.settlements s ON s.id = t.settlement_id
        WHERE {CURRENT_SETTLEMENT} AND t.received_at IS NULL'''), steps=[(None, GREEN), (1, ORANGE)], w=5)
    b.stat("Montant à verser", Sql(f'''
        SELECT coalesce(sum(t.amount), 0) FROM session.settlement_transfers t JOIN session.settlements s ON s.id = t.settlement_id
        WHERE {CURRENT_SETTLEMENT} AND t.received_at IS NULL'''), unit=AUEC, steps=[(None, GREEN), (1, ORANGE)], w=5)
    b.stat("Raffinage prêt, non remis", Sql('''
        SELECT count(*) FROM mining.refinery_orders WHERE finishes_at <= localtimestamp AND handed_over_at IS NULL'''),
        steps=[(None, GREEN), (1, ORANGE)], w=5, description="Ordres de raffinage terminés dont le minerai n'a pas été remis au destinataire.")
    b.table("Fiches de la période", Sql(f'''
        SELECT sh.session_date AS "Date", sh.name AS "Fiche", o.username AS "Organisateur",
               CASE sh.status WHEN 'ACTIVE' THEN 'En cours' WHEN 'SETTLEMENT' THEN 'En règlement' ELSE 'Clôturée' END AS "Statut",
               (SELECT count(*) FROM session.participants pa WHERE pa.sheet_id = sh.id) AS "Participants",
               (SELECT sum(amount) FROM session.sales sa WHERE sa.sheet_id = sh.id) AS "Ventes",
               (SELECT sum(amount) FROM mining_fees ex WHERE ex.sheet_id = sh.id) AS "Frais avancés",
               (SELECT sum(amount) FROM session.sales sa WHERE sa.sheet_id = sh.id)
                 - coalesce((SELECT sum(amount) FROM mining_fees ex WHERE ex.sheet_id = sh.id), 0) AS "Net",
               (SELECT CASE WHEN count(*) > 0 THEN count(*) FILTER (WHERE t.received_at IS NOT NULL) || ' / ' || count(*) END
                  FROM session.settlement_transfers t JOIN session.settlements s ON s.id = t.settlement_id
                 WHERE s.sheet_id = sh.id AND {CURRENT_SETTLEMENT}) AS "Virements reçus"
        FROM session.sheets sh JOIN core.users o ON o.id = sh.organizer_user_id
        WHERE $__timeFilter(sh.session_date) ORDER BY sh.session_date DESC, sh.name LIMIT 50'''),
        columns={"Date": {"unit": "dateTimeAsLocalNoDateIfToday", "width": 110},
                 "Ventes": {"unit": AUEC, "decimals": 0}, "Frais avancés": {"unit": AUEC, "decimals": 0},
                 "Net": {"unit": AUEC, "decimals": 0, "steps": [(None, RED), (0, GREEN)]},
                 "Virements reçus": {"width": 130}},
        description="Ventes vides : aucune vente saisie. Virements reçus : confirmés sur le total du règlement en cours.")
    b.row("Partage entre participants")
    b.table("Frais avancés et remboursement", Sql(f'''
        SELECT sh.session_date AS "Date", sh.name AS "Fiche", u.username AS "Participant",
               ss.shares_centi / 100.0 AS "Parts", ss.share AS "Part du bénéfice", ss.advanced AS "Frais avancés",
               ss.balance AS "Dû au participant", ss.cashed AS "Ventes encaissées",
               ss.balance - ss.cashed AS "Reste à recevoir (+) ou à verser (−)"
        FROM session.settlement_shares ss
        JOIN session.settlements s ON s.id = ss.settlement_id JOIN session.sheets sh ON sh.id = s.sheet_id
        JOIN core.users u ON u.id = ss.user_id
        WHERE {CURRENT_SETTLEMENT} AND $__timeFilter(sh.session_date)
        ORDER BY sh.session_date DESC, sh.name, ss.position LIMIT 200'''),
        columns={"Date": {"width": 110}, "Parts": {"decimals": 2, "width": 70},
                 "Part du bénéfice": {"unit": AUEC, "decimals": 0}, "Frais avancés": {"unit": AUEC, "decimals": 0},
                 "Dû au participant": {"unit": AUEC, "decimals": 0}, "Ventes encaissées": {"unit": AUEC, "decimals": 0},
                 "Reste à recevoir (+) ou à verser (−)": {"unit": AUEC, "decimals": 0,
                                                         "steps": [(None, ORANGE), (0, GREEN)]}},
        h=10, description="Photographie de l'arrêt des comptes. Dû au participant = part du bénéfice + remboursement de ses "
                          "frais avancés. Il a déjà encaissé ses propres ventes : la différence est réglée par virements.")
    b.table("Virements entre participants", Sql(f'''
        SELECT sh.session_date AS "Date", sh.name AS "Fiche", f.username AS "Verse", t2.username AS "Reçoit",
               t.amount AS "Montant",
               CASE WHEN t.received_at IS NULL THEN 'En attente' ELSE 'Reçu' END AS "État",
               t.received_at AS "Confirmé le"
        FROM session.settlement_transfers t
        JOIN session.settlements s ON s.id = t.settlement_id JOIN session.sheets sh ON sh.id = s.sheet_id
        JOIN core.users f ON f.id = t.from_user_id JOIN core.users t2 ON t2.id = t.to_user_id
        WHERE {CURRENT_SETTLEMENT} AND $__timeFilter(sh.session_date)
        ORDER BY (t.received_at IS NULL) DESC, sh.session_date DESC, t.position LIMIT 200'''),
        columns={"Date": {"width": 110}, "Montant": {"unit": AUEC, "decimals": 0},
                 "État": {"width": 110, "mappings": [{"type": "value", "options": {
                     "En attente": {"color": ORANGE}, "Reçu": {"color": GREEN}}}],
                          "steps": [(None, "text")]},
                 "Confirmé le": {"unit": "dateTimeAsLocal", "width": 170}}, h=10)
    b.row("Activité")
    b.series("Ventes et frais par semaine", [
        (ts('''SELECT date_trunc('week', sh.session_date) AS time, sum(sa.amount) AS "Ventes"
               FROM session.sales sa JOIN session.sheets sh ON sh.id = sa.sheet_id
               WHERE $__timeFilter(sh.session_date) GROUP BY 1 ORDER BY 1'''), ""),
        (ts('''SELECT date_trunc('week', sh.session_date) AS time, sum(ex.amount) AS "Frais avancés"
               FROM mining_fees ex JOIN session.sheets sh ON sh.id = ex.sheet_id
               WHERE $__timeFilter(sh.session_date) GROUP BY 1 ORDER BY 1'''), ""),
    ], unit=AUEC, bars=True)
    b.bars("Frais par nature", Sql('''
        SELECT CASE ex.kind WHEN 'FUEL' THEN 'Carburant' WHEN 'REPAIR' THEN 'Réparations'
                            WHEN 'MATERIAL' THEN 'Matériel' WHEN 'REFINING' THEN 'Raffinage' ELSE 'Autre' END AS metric, sum(ex.amount) AS value
        FROM mining_fees ex JOIN session.sheets sh ON sh.id = ex.sheet_id
        WHERE $__timeFilter(sh.session_date) GROUP BY 1 ORDER BY 2 DESC'''), "", unit=AUEC)
    b.bars("Minerais vendus", Sql('''
        SELECT sl.commodity_name AS metric, sum(sl.quantity_cscu) / 100.0 AS value
        FROM mining.sale_lines sl JOIN session.sales sa ON sa.id = sl.sale_id JOIN session.sheets sh ON sh.id = sa.sheet_id
        WHERE $__timeFilter(sh.session_date) GROUP BY 1 ORDER BY 2 DESC LIMIT 12'''), "", unit=SCU, w=8, h=10)
    b.bars("Ventes par terminal", Sql('''
        SELECT sa.terminal_label AS metric, sum(sa.amount) AS value
        FROM session.sales sa JOIN session.sheets sh ON sh.id = sa.sheet_id
        WHERE $__timeFilter(sh.session_date) GROUP BY 1 ORDER BY 2 DESC LIMIT 12'''), "", unit=AUEC, w=8, h=10)
    b.bars("Méthodes de raffinage", Sql('''
        SELECT coalesce(ro.method_label, ro.method_code, 'Non précisée') AS metric, count(*) AS value
        FROM mining.refinery_orders ro JOIN session.sheets sh ON sh.id = ro.sheet_id
        WHERE $__timeFilter(sh.session_date) GROUP BY 1 ORDER BY 2 DESC'''), "", w=8, h=10)
    b.bars("Mineurs les plus présents", Sql('''
        SELECT u.username AS metric, count(*) AS value
        FROM session.participants pa JOIN session.sheets sh ON sh.id = pa.sheet_id JOIN core.users u ON u.id = pa.user_id
        WHERE $__timeFilter(sh.session_date) GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10'''), "",
        description="Nombre de fiches auxquelles chaque membre a participé.")
    b.bars("Bénéfice reçu par membre", Sql(f'''
        SELECT u.username AS metric, sum(ss.share) AS value
        FROM session.settlement_shares ss JOIN session.settlements s ON s.id = ss.settlement_id
        JOIN session.sheets sh ON sh.id = s.sheet_id JOIN core.users u ON u.id = ss.user_id
        WHERE {CURRENT_SETTLEMENT} AND $__timeFilter(sh.session_date) GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10'''), "",
        unit=AUEC, description="Part du bénéfice des règlements en cours, hors remboursement des frais avancés.")
    b.row("Déroulement des fiches")
    b.stat("Fiches liées à une opération", Sql('''
        SELECT round(count(*) FILTER (WHERE operation_event_id IS NOT NULL)::numeric / nullif(count(*), 0), 3)
        FROM session.sheets WHERE $__timeFilter(session_date)'''), unit="percentunit", w=6)
    b.stat("Délai moyen jusqu'à la clôture", Sql('''
        SELECT avg(extract(epoch FROM h.at - sh.created_at)) FROM session.sheets sh
        JOIN session.history h ON h.sheet_id = sh.id AND h.action IN ('CLOSED', 'FORCED_CLOSE')
        WHERE $__timeFilter(sh.session_date)'''), unit="s", w=6,
        description="De la création de la fiche à sa clôture : ventes, partage et confirmation de tous les virements.")
    b.stat("Durée moyenne de raffinage", Sql('''
        SELECT avg(extract(epoch FROM ro.finishes_at - ro.created_at)) FROM mining.refinery_orders ro
        JOIN session.sheets sh ON sh.id = ro.sheet_id WHERE $__timeFilter(sh.session_date)'''), unit="s", w=6)
    b.stat("Coût du raffinage", Sql('''
        SELECT sum(ro.cost) FROM mining.refinery_orders ro JOIN session.sheets sh ON sh.id = ro.sheet_id
        WHERE $__timeFilter(sh.session_date)'''), unit=AUEC, w=6,
        description="Coût des ordres de raffinage : compris dans les frais avancés, remboursé au membre qui a lancé l'ordre.")
    b.bars("Étapes et corrections", Sql('''
        SELECT CASE h.action WHEN 'SETTLED' THEN 'Comptes arrêtés' WHEN 'CLOSED' THEN 'Clôtures'
                             WHEN 'FORCED_CLOSE' THEN 'Clôtures forcées' WHEN 'REOPENED_SETTLEMENT' THEN 'Réouvertures du règlement'
                             WHEN 'REOPENED_ACTIVE' THEN 'Retours en cours' WHEN 'RECEIPT_CONFIRMED' THEN 'Virements confirmés'
                             WHEN 'RECEIPT_WITHDRAWN' THEN 'Confirmations retirées' ELSE h.action END AS metric, count(*) AS value
        FROM session.history h JOIN session.sheets sh ON sh.id = h.sheet_id
        WHERE $__timeFilter(sh.session_date) GROUP BY 1 ORDER BY 2 DESC'''), "",
        description="Réouvertures et clôtures forcées signalent des comptes corrigés après coup ou des virements jamais confirmés.")
    b.bars("Minerai raffiné", Sql('''
        SELECT l.commodity_name AS metric, sum(l.quantity_cscu) / 100.0 AS value
        FROM mining.refinery_order_lines l JOIN mining.refinery_orders ro ON ro.id = l.order_id
        JOIN session.sheets sh ON sh.id = ro.sheet_id
        WHERE $__timeFilter(sh.session_date) GROUP BY 1 ORDER BY 2 DESC LIMIT 12'''), "", unit=SCU)
    b.write()


def content():
    b = Board("iceforge-contenu", "Contenu et données",
              "Actualités, veille CIG et synchronisation du catalogue Star Citizen.",
              time_from="now-30d", refresh="5m", kind="metier")
    b.row("Actualités")
    b.stat("Publiées sur la période", Sql("SELECT count(*) FROM news.news WHERE $__timeFilter(created_at)"), w=6)
    b.stat("Guides publiés", Sql("SELECT count(*) FROM public.content_guides WHERE published"), w=6)
    b.stat("Dernière collecte CIG", Sql(
        "SELECT extract(epoch FROM now() - max(last_fetched_at)) FROM news.cig_watch_fetch_state"),
        unit="s", steps=[(None, GREEN), (1800, ORANGE), (3 * 3600, RED)], w=6,
        description="La veille interroge les sources toutes les 5 minutes.")
    b.stat("Erreurs de collecte (24 h)", Sql(
        "SELECT count(*) FROM news.cig_watch_fetch_errors WHERE fetched_at >= now() - interval '24 hours'"),
        steps=[(None, GREEN), (1, ORANGE), (20, RED)], w=6)
    b.stat("Traductions en attente", Sql(
        "SELECT count(*) FROM news.cig_watch_entries WHERE translation_status <> 'TRANSLATED'"),
        steps=[(None, GREEN), (1, ORANGE)], w=6)
    b.stat("Envois Discord en échec", Sql(
        "SELECT count(*) FROM news.cig_watch_entries WHERE delivery_status = 'FAILED'"),
        steps=[(None, GREEN), (1, RED)], w=6)
    b.stat("Envois Discord en attente", Sql(
        "SELECT count(*) FROM news.cig_watch_entries WHERE delivery_status = 'PENDING'"),
        steps=[(None, GREEN), (1, ORANGE)], w=6)
    b.stat("Entrées CIG collectées", Sql(
        "SELECT count(*) FROM news.cig_watch_entries WHERE $__timeFilter(fetched_at)"), w=6)
    b.series("Entrées CIG par jour et source", [(ts('''
        SELECT date_trunc('day', fetched_at) AS time, source_label AS metric, count(*) AS value
        FROM news.cig_watch_entries WHERE $__timeFilter(fetched_at) GROUP BY 1, 2 ORDER BY 1'''), "")],
        bars=True, stack=True)
    b.series("Actualités publiées par semaine", [(ts('''
        SELECT date_trunc('week', n.created_at) AS time, coalesce(t.name, 'Sans type') AS metric, count(*) AS value
        FROM news.news n LEFT JOIN news.news_type t ON t.id = n.type_id
        WHERE $__timeFilter(n.created_at) GROUP BY 1, 2 ORDER BY 1'''), "")], bars=True, stack=True)
    b.row("Catalogue Star Citizen")
    b.stat("Dernière synchronisation réussie", Sql(
        "SELECT extract(epoch FROM now() - max(completed_at)) FROM catalog.sync_runs WHERE status = 'SUCCEEDED'"),
        unit="s", steps=[(None, GREEN), (14 * 86400, ORANGE), (45 * 86400, RED)], w=6)
    b.stat("Synchronisations en échec", Sql(
        "SELECT count(*) FROM catalog.sync_runs WHERE status = 'FAILED' AND $__timeFilter(created_at)"),
        steps=[(None, GREEN), (1, RED)], w=6)
    b.stat("Conflits à arbitrer", Sql("SELECT count(*) FROM catalog.sync_conflicts WHERE status = 'PENDING'"),
           steps=[(None, GREEN), (1, ORANGE)], w=6,
           description="Plusieurs sources proposent des fiches différentes : un administrateur doit choisir.")
    b.stat("Entrées actives", Sql("SELECT count(*) FROM catalog.entries WHERE active"), w=6)
    b.table("Dernières synchronisations", Sql('''
        SELECT created_at AS "Lancée", operation AS "Opération", coalesce(scope, 'Tout') AS "Périmètre",
               CASE status WHEN 'SUCCEEDED' THEN 'Réussie' WHEN 'FAILED' THEN 'Échec' WHEN 'RUNNING' THEN 'En cours'
                           WHEN 'QUEUED' THEN 'En file' WHEN 'WAITING_FOR_REVIEW' THEN 'À arbitrer' ELSE status END AS "Statut",
               extract(epoch FROM completed_at - started_at) AS "Durée", message AS "Message"
        FROM catalog.sync_runs ORDER BY created_at DESC LIMIT 15'''),
        columns={"Lancée": {"unit": "dateTimeAsLocal", "width": 170}, "Durée": {"unit": "s", "width": 100},
                 "Statut": {"width": 120, "steps": [(None, "text")], "mappings": [{"type": "value", "options": {
                     "Réussie": {"color": GREEN}, "Échec": {"color": RED}, "À arbitrer": {"color": ORANGE},
                     "En cours": {"color": BLUE}, "En file": {"color": BLUE}}}]}}, w=14, h=9)
    b.bars("Entrées actives par famille", Sql('''
        SELECT coalesce(family, 'Sans famille') AS metric, count(*) AS value FROM catalog.entries
        WHERE active GROUP BY 1 ORDER BY 2 DESC LIMIT 12'''), "", w=10, h=9)
    b.row("Données de jeu des outils")
    b.stat("Offres de prix actives", Sql("SELECT count(*) FROM catalog.offers WHERE active"), w=4,
           description="Prix d'achat, de vente et de location utilisés par les outils Ressources et Achat de vaisseaux.")
    b.stat("Emplacements de minerai", Sql("SELECT count(*) FROM public.ore_locations"), w=4)
    b.stat("Scans de minerai cumulés", Sql("SELECT sum(scans_count) FROM public.ore_locations"), w=4,
           description="Nombre de scans communautaires agrégés dans les données d'emplacement importées.")
    b.stat("Recettes Wikelo", Sql('''
        SELECT (SELECT count(*) FROM utils.wikelo_ships) + (SELECT count(*) FROM catalog.wikelo_equipment_recipes WHERE active)'''),
        w=4, description="Vaisseaux et équipements échangeables chez Wikelo.")
    b.stat("Planètes, lunes et stations", Sql('''
        SELECT (SELECT count(*) FROM public.celestial_bodies) + (SELECT count(*) FROM public.orbital_stations)'''), w=4)
    b.stat("Images hébergées", Sql("SELECT sum(size) FROM media.image_metadata"), unit="bytes", w=4,
           description="Taille totale des images envoyées par les administrateurs.")
    b.table("Fraîcheur des données UEX", Sql('''
        SELECT dataset_key AS "Jeu de données", item_count AS "Éléments", game_version AS "Version du jeu",
               fetched_at AS "Récupéré le", extract(epoch FROM now() - fetched_at) AS "Âge"
        FROM utils.uex_dataset_cache ORDER BY fetched_at, dataset_key'''),
        columns={"Récupéré le": {"unit": "dateTimeAsLocal", "width": 170},
                 "Âge": {"unit": "s", "width": 110, "steps": [(None, GREEN), (7 * 86400, ORANGE), (30 * 86400, RED)]}},
        w=14, h=10, description="Prix et terminaux servis par les outils publics. Un jeu ancien donne des prix périmés.")
    b.bars("Emplacements de minerai par version du jeu", Sql('''
        SELECT coalesce(game_version, 'Version inconnue') AS metric, count(*) AS value FROM public.ore_locations
        GROUP BY 1 ORDER BY 1 DESC'''), "", w=10, h=10)
    b.bars("Images par catégorie", Sql('''
        SELECT coalesce(category, 'Sans catégorie') AS metric, count(*) AS value FROM media.image_metadata
        GROUP BY 1 ORDER BY 2 DESC LIMIT 12'''), "", w=8)
    b.stat("Actualités relayées sur Discord", Sql('''
        SELECT round(count(*) FILTER (WHERE discord_message_id IS NOT NULL)::numeric / nullif(count(*), 0), 3)
        FROM news.news WHERE $__timeFilter(created_at)'''), unit="percentunit", w=8, h=8,
        description="Part des actualités de la période publiées sur le serveur Discord.")
    b.stat("Blocs IceLink", Sql("SELECT count(*) FROM icelink.icelink_block"), w=8, h=8)
    b.write()


# Fonctionnalités du site et routes d'API qu'elles appellent (controller/**). Chaque page Angular
# charge ses données par ces routes : les compter mesure l'usage réel, outils publics compris.
PUBLIC_FEATURES = [
    ("Ressources de minage", "/api/front/(resources/.*|ore-locations|celestial-bodies|stations|location-images)"),
    ("Achat et location de vaisseaux", "/api/front/vehicles/.*"),
    ("Objets", "/api/front/items"),
    ("Wikelo", "/api/wikelo/.*"),
    ("Guides", "/api/guides.*"),
    ("Hangar exécutif", "/api/utils/executive-hangar/.*"),
    ("Catalogue des vaisseaux", "/api/ships.*"),
    ("Accueil (membres, derniers événements)", "/api/front/(members|recent-events)"),
    ("Actualités", "/api/news(/types)?"),
]
MEMBER_FEATURES = [
    ("Événements", "/api/events.*"),
    ("Opérations", "/api/operations.*"),
    ("Fiches de minage", "/api/sessions.*"),
    ("Objectifs", "/api/goals.*|/api/goal-templates.*"),
    ("Flotte", "/api/user-ships.*"),
    ("Collections", "/api/collections.*"),
    ("Événements Star Citizen", "/api/sc-world-events.*|/api/sc-world-event-types.*"),
    ("Profil et membres", "/api/users.*"),
    ("Veille CIG", "/api/news/cig/.*"),
    ("IceLink", "/api/icelink.*"),
    ("Notifications push", "/api/notifications/.*"),
    ("Images", "/api/images.*"),
    ("Administration (catalogue, données)", "/api/admin/.*|/api/utils/uex/.*"),
]
WRITE = 'method=~"POST|PUT|PATCH|DELETE"'


def _calls(uri, extra="", window="$__range"):
    sel = f'job="backend", uri=~"{uri}"' + (f", {extra}" if extra else "")
    # Une route jamais appelée n'a pas encore de série : 0 mesuré si le backend répond, sinon « Pas de donnée ».
    return (f"round(sum(increase(http_server_requests_seconds_count{{{sel}}}[{window}])))"
            f' or on () (0 * max(up{{job="backend"}} == 1))')


def usage():
    b = Board("iceforge-utilisation", "Utilisation du site",
              "Appels à l'API par fonctionnalité : ce que les visiteurs et les membres utilisent vraiment. "
              "Historique limité à la rétention de Prometheus.", time_from="now-7d", refresh="5m", kind="metier")
    b.row("Connexions et formulaires publics")
    b.stat("Connexions réussies", _calls("/api/auth/login", 'outcome="SUCCESS"'), w=4)
    b.stat("Connexions refusées", _calls("/api/auth/login", 'outcome="CLIENT_ERROR"'),
           steps=[(None, GREEN), (20, ORANGE), (100, RED)], w=4,
           description="Mot de passe erroné, compte inconnu ou limite de tentatives (429).")
    b.stat("Sessions prolongées", _calls("/api/auth/refresh", 'outcome="SUCCESS"'), w=4,
           description="Renouvellements automatiques du jeton (toutes les 15 minutes d'utilisation).")
    b.stat("Réinitialisations de mot de passe", _calls("/api/auth/reset-password", 'outcome="SUCCESS"'), w=4)
    b.stat("Candidatures envoyées", _calls("/api/recruitment", 'method="POST", outcome="SUCCESS"'), w=4)
    b.stat("Actions venues de Discord", _calls(".*/bot.*", 'outcome="SUCCESS"'), w=4,
           description="Appels du bot : participation par bouton, liaison de compte, flotte déclarée sur Discord.")
    b.row("Outils publics")
    b.bars("Appels par outil public", [(_calls(uri), name) for name, uri in PUBLIC_FEATURES], "", h=10,
           description="Nombre d'appels sur la période. Une visite de page déclenche en général plusieurs appels.")
    b.series("Outils publics dans le temps",
             [(f'sum(rate(http_server_requests_seconds_count{{job="backend", uri=~"{uri}"}}[$__rate_interval])) * 3600', name)
              for name, uri in PUBLIC_FEATURES], unit="short", h=10, description="Appels par heure.")
    b.row("Espace membre")
    b.bars("Appels par fonctionnalité", [(_calls(uri), name) for name, uri in MEMBER_FEATURES], "", h=11)
    b.bars("Modifications par fonctionnalité", [(_calls(uri, WRITE), name) for name, uri in MEMBER_FEATURES], "", h=11,
           description="Créations, modifications et suppressions (POST, PUT, PATCH, DELETE) réussies ou non.")
    b.series("Espace membre dans le temps",
             [(f'sum(rate(http_server_requests_seconds_count{{job="backend", uri=~"{uri}"}}[$__rate_interval])) * 3600', name)
              for name, uri in MEMBER_FEATURES], unit="short", h=10, w=24, description="Appels par heure.")
    b.row("Détail")
    b.bars("Routes les plus appelées", f'topk(20, round(sum by (method, uri) (increase(http_server_requests_seconds_count{{{HTTP}}}[$__range]))))',
           "{{method}} {{uri}}", h=14)
    b.bars("Routes en erreur", f'topk(20, round(sum by (method, uri, status) (increase(http_server_requests_seconds_count{{{HTTP}, outcome=~"CLIENT_ERROR|SERVER_ERROR"}}[$__range]))) > 0)',
           "{{status}} {{method}} {{uri}}", steps=[(None, ORANGE)], h=14,
           description="401 sur une route membre : visiteur non connecté ou session expirée.")
    b.write()


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for build in (overview, backend, rabbitmq, host, usage, community, events, mining, content):
        build()
