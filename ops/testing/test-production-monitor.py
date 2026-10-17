"""Mail state machine tests; no network, production access or real credentials."""
import importlib.util
import contextlib
import io
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import smtplib
import ssl
import subprocess
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / 'production/monitoring/production-monitor.py'
spec = importlib.util.spec_from_file_location('production_monitor', SOURCE)
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)


def observation(cause):
    healthy = {'status': 'running', 'health': 'healthy'}
    return {'cause': cause, 'http': 200 if cause == 'OK' else 502,
            'backend': healthy, 'bot': healthy, 'vault_sealed': cause == 'VAULT_SEALED'}


class MonitorTests(unittest.TestCase):
    def configure(self, config, sender, writer):
        with patch('sys.argv', [str(SOURCE), 'configure']), patch('os.geteuid', return_value=0), \
                patch('sys.stdin', io.StringIO(json.dumps(config))), contextlib.redirect_stdout(io.StringIO()), \
                patch.object(monitor, 'send_email', sender), patch.object(monitor, 'write_protected', writer):
            monitor.main()

    def test_configuration_is_saved_only_after_successful_test_email(self):
        from unittest.mock import Mock
        config = {'provider': 'brevo', 'smtp_username': 'technical@smtp-brevo.com',
                  'sender': 'alertes@iceforge.fr', 'recipient': 'operateur@example.org',
                  'smtp_password': 'synthetic-smtp-key'}
        calls = Mock()
        self.configure(config, calls.send, calls.write)
        self.assertEqual([call[0] for call in calls.method_calls], ['send', 'write'])
        self.assertEqual(calls.write.call_args.args[1]['heartbeat_days'], 30)
        failed_sender = Mock(side_effect=smtplib.SMTPException('synthetic'))
        writer = Mock()
        with self.assertRaises(smtplib.SMTPException):
            self.configure(config, failed_sender, writer)
        writer.assert_not_called()

    def test_invalid_sender_cannot_inject_headers_or_save_credentials(self):
        from unittest.mock import Mock
        config = {'provider': 'brevo', 'smtp_username': 'technical@smtp-brevo.com',
                  'sender': 'alertes@iceforge.fr\r\nBcc: injected@example.test',
                  'recipient': 'operateur@example.org', 'smtp_password': 'synthetic'}
        sender, writer = Mock(), Mock()
        with self.assertRaises(RuntimeError):
            self.configure(config, sender, writer)
        sender.assert_not_called()
        writer.assert_not_called()

    def test_alert_after_two_failures_and_no_spam(self):
        sent = []
        notify = lambda subject, body: sent.append((subject, body))
        state = monitor.transition({}, observation('VAULT_SEALED'), notify)
        self.assertEqual(sent, [])
        for i in range(10):
            state = monitor.transition(state, observation('VAULT_SEALED'), notify)
        self.assertEqual(len(sent), 1)
        self.assertIn('Vault scellé', sent[0][0])
        self.assertIn('unseal-from-windows.ps1', sent[0][1])

    def test_one_recovery_email_and_no_recovery_for_unnotified_blip(self):
        sent = []
        notify = lambda subject, body: sent.append(subject)
        state = monitor.transition({'notified_cause': 'BACKEND_DOWN', 'failures': 5}, observation('OK'), notify)
        state = monitor.transition(state, observation('OK'), notify)
        self.assertEqual(sent, ['[IceForge] Service rétabli'])
        monitor.transition({'failures': 1}, observation('OK'), notify)
        self.assertEqual(len(sent), 1)

    def test_different_diagnosis_is_notified_once(self):
        sent = []
        notify = lambda subject, body: sent.append(subject)
        state = {'notified_cause': 'BACKEND_DOWN', 'failures': 5}
        state = monitor.transition(state, observation('VAULT_SEALED'), notify)
        monitor.transition(state, observation('VAULT_SEALED'), notify)
        self.assertEqual(len(sent), 1)

    def test_failed_alert_or_recovery_does_not_mark_email_as_delivered(self):
        for cause in ('OK', 'VAULT_SEALED'):
            state = {'failures': 5, 'notified_cause': 'BACKEND_DOWN'}
            original = dict(state)
            def fail(subject, body):
                raise smtplib.SMTPException('synthetic')
            with self.assertRaises(smtplib.SMTPException):
                monitor.transition(state, observation(cause), fail)
            self.assertEqual(state, original)

    def test_vault_sealed_is_diagnosed_even_if_cached_backend_still_responds(self):
        services = {'backend': {'status': 'running', 'health': 'healthy'},
                    'bot': {'status': 'running', 'health': 'healthy'}}
        class Response:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *args): pass
        with patch.object(monitor, 'inspect_services', return_value=services), \
                patch.object(monitor, 'command', return_value={'sealed': True}), \
                patch('urllib.request.urlopen', return_value=Response()):
            self.assertEqual(monitor.probe()['cause'], 'VAULT_SEALED')

    def test_docker_timeout_does_not_prevent_an_alert(self):
        with patch('subprocess.run', side_effect=subprocess.TimeoutExpired(['docker'], 8)):
            self.assertIsNone(monitor.command(['docker', 'inspect']))

    def test_credentials_are_not_in_alert_body(self):
        body = monitor.email_body(observation('VAULT_SEALED'))
        for forbidden in ('smtp_password', 'root_token', 'unseal_keys_b64'):
            self.assertNotIn(forbidden, body)

    def test_mail_requires_verified_tls_before_login_and_preserves_recipient(self):
        config = {'smtp_username': 'operateur@example.org', 'recipient': 'operateur@example.org',
                  'smtp_password': 'synthetic-test-only'}
        with patch('smtplib.SMTP') as smtp:
            client = smtp.return_value.__enter__.return_value
            monitor.send_email(config, '[IceForge] Test', 'synthetic body')
        smtp.assert_called_once_with('smtp.gmail.com', 587, timeout=10)
        self.assertIsInstance(client.starttls.call_args.kwargs['context'], ssl.SSLContext)
        methods = [call[0] for call in client.method_calls]
        self.assertLess(methods.index('starttls'), methods.index('login'))
        self.assertEqual(client.send_message.call_args.args[0]['To'], config['recipient'])
        self.assertNotIn(config['smtp_password'], client.send_message.call_args.args[0].as_string())

    def test_brevo_login_is_distinct_from_verified_sender_and_gmail_recipient(self):
        config = {'provider': 'brevo', 'smtp_username': 'technical@smtp-brevo.com',
                  'sender': 'alertes@iceforge.fr', 'recipient': 'operateur@example.org',
                  'smtp_password': 'synthetic-smtp-key'}
        with patch('smtplib.SMTP') as smtp:
            client = smtp.return_value.__enter__.return_value
            monitor.send_email(config, '[IceForge] Test', 'synthetic body')
        smtp.assert_called_once_with('smtp-relay.brevo.com', 587, timeout=10)
        client.login.assert_called_once_with(config['smtp_username'], config['smtp_password'])
        message = client.send_message.call_args.args[0]
        self.assertEqual(message['From'], 'alertes@iceforge.fr')
        self.assertEqual(message['To'], 'operateur@example.org')
        self.assertNotIn(config['smtp_password'], message.as_string())

    def test_local_postfix_does_not_need_cloud_credentials_and_adds_required_headers(self):
        config = {'provider': 'local', 'smtp_username': 'alertes@iceforge.fr', 'sender': 'alertes@iceforge.fr',
                  'recipient': 'operateur@example.org'}
        with patch('smtplib.SMTP') as smtp:
            client = smtp.return_value.__enter__.return_value
            monitor.send_email(config, '[IceForge] Test local', 'synthetic body')
        smtp.assert_called_once_with('127.0.0.1', 25, timeout=10)
        client.login.assert_not_called()
        client.starttls.assert_not_called()
        message = client.send_message.call_args.args[0]
        self.assertEqual(message['From'], 'alertes@iceforge.fr')
        self.assertEqual(message['To'], 'operateur@example.org')
        self.assertIsNotNone(message['Date'])
        self.assertIsNotNone(message['Message-ID'])

    def test_local_mail_requires_exactly_one_spf_authorizing_the_vps(self):
        for answer, expected in [('', False), ('"v=spf1 ip4:82.29.170.11 ~all"', True),
                                  ('"v=spf1 ip4:82.29.170.11/32 -all"', True),
                                  ('"v=spf1 -all ip4:82.29.170.11"', False),
                                  ('"v=spf1 ip4:82.29.170.11 +all"', False),
                                  ('"v=spf1 ?ip4:82.29.170.11 ~all"', False),
                                  ('"v=spf1 ip4:82.29.170.110 ~all"', False),
                                  ('"v=spf1 ip4:82.29.170.11 ~all"\n"v=spf1 -all"', False)]:
            with patch('subprocess.run', return_value=subprocess.CompletedProcess([], 0, answer, '')):
                self.assertEqual(monitor.local_spf_ready(), expected)

    def test_local_configuration_waits_for_dns_without_sending_or_saving(self):
        with patch('sys.argv', [str(SOURCE), 'configure-local']), patch('os.geteuid', return_value=0), \
                patch.object(monitor, 'local_spf_ready', return_value=False), \
                patch.object(monitor, 'send_email') as sender, patch.object(monitor, 'write_protected') as writer, \
                contextlib.redirect_stdout(io.StringIO()) as output:
            monitor.main()
        sender.assert_not_called()
        writer.assert_not_called()
        self.assertIn('WAITING_FOR_SPF', output.getvalue())

    def run_local(self, *extra, config_exists=False):
        with patch('sys.argv', [str(SOURCE), 'configure-local', *extra]), patch('os.geteuid', return_value=0), \
                patch.object(monitor, 'local_spf_ready', return_value=True), \
                patch.object(monitor, 'CONFIG', Path('/nonexistent/iceforge-monitor/config.json')) if not config_exists else contextlib.nullcontext(), \
                patch.object(monitor, 'send_email') as sender, patch.object(monitor, 'write_protected') as writer, \
                contextlib.redirect_stdout(io.StringIO()) as output:
            monitor.main()
        return sender, writer, output.getvalue()

    def test_local_configuration_needs_a_recipient_outside_the_repository(self):
        sender, writer, output = self.run_local()
        sender.assert_not_called()
        writer.assert_not_called()
        self.assertIn('WAITING_FOR_RECIPIENT', output)
        sender, writer, output = self.run_local('--recipient', 'not-an-address')
        sender.assert_not_called()

    def test_local_configuration_sends_to_the_given_recipient(self):
        sender, writer, output = self.run_local('--recipient', 'operateur@example.org')
        self.assertEqual(sender.call_args.args[0]['recipient'], 'operateur@example.org')
        self.assertEqual(writer.call_args.args[1]['recipient'], 'operateur@example.org')
        self.assertIn('QUEUED', output)

    def test_monthly_check_keeps_an_idle_brevo_key_active_without_daily_spam(self):
        now = datetime(2026, 10, 17, tzinfo=timezone.utc)
        sent = []
        notify = lambda subject, body: sent.append((subject, body))
        state = monitor.transition({}, observation('OK'), notify, heartbeat_days=30, now=now)
        self.assertEqual(sent, [])
        state = monitor.transition(state, observation('OK'), notify, heartbeat_days=30, now=now+timedelta(days=29))
        self.assertEqual(sent, [])
        state = monitor.transition(state, observation('OK'), notify, heartbeat_days=30, now=now+timedelta(days=30))
        monitor.transition(state, observation('OK'), notify, heartbeat_days=30, now=now+timedelta(days=31))
        self.assertEqual(len(sent), 1)
        self.assertIn('Vérification mensuelle', sent[0][0])
        self.assertNotIn('service rétabli', sent[0][1])

    def test_failed_monthly_mail_is_retried_and_does_not_reset_last_delivery(self):
        now = datetime(2026, 10, 17, tzinfo=timezone.utc)
        state = {'failures': 0, 'last_delivery_at': (now-timedelta(days=31)).isoformat()}
        original = dict(state)
        def fail(subject, body): raise smtplib.SMTPException('synthetic')
        with self.assertRaises(smtplib.SMTPException):
            monitor.transition(state, observation('OK'), fail, heartbeat_days=30, now=now)
        self.assertEqual(state, original)

    def test_monthly_delivery_also_continues_during_a_persistent_incident(self):
        now = datetime(2026, 10, 17, tzinfo=timezone.utc)
        state = {'failures': 200, 'notified_cause': 'VAULT_SEALED',
                 'last_delivery_at': (now-timedelta(days=31)).isoformat()}
        sent = []
        notify = lambda subject, body: sent.append((subject, body))
        updated = monitor.transition(state, observation('VAULT_SEALED'), notify, heartbeat_days=30, now=now)
        monitor.transition(updated, observation('VAULT_SEALED'), notify, heartbeat_days=30, now=now+timedelta(days=1))
        self.assertEqual(len(sent), 1)
        self.assertIn('incident toujours présent', sent[0][0])
        original = dict(state)
        def fail(subject, body): raise smtplib.SMTPException('synthetic')
        with self.assertRaises(smtplib.SMTPException):
            monitor.transition(state, observation('VAULT_SEALED'), fail, heartbeat_days=30, now=now)
        self.assertEqual(state, original)


if __name__ == '__main__':
    unittest.main(verbosity=2)
