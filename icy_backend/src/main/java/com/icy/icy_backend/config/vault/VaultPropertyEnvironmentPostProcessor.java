package com.icy.icy_backend.config.vault;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

public class VaultPropertyEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        boolean enabled = Boolean.parseBoolean(getProperty(environment, "vault.enabled", "VAULT_ENABLED", "false"));
        if (!enabled) {
            return;
        }

        boolean failFast = Boolean.parseBoolean(getProperty(environment, "vault.fail-fast", "VAULT_FAIL_FAST", "true"));

        try {
            String address = require(environment, "vault.address", "VAULT_ADDR");
            String mount = getProperty(environment, "vault.kv.mount", "VAULT_KV_MOUNT", "secret");
            String path = require(environment, "vault.kv.path", "VAULT_KV_PATH");
            String roleId = require(environment, "vault.auth.role-id", "VAULT_ROLE_ID");
            String secretId = require(environment, "vault.auth.secret-id", "VAULT_SECRET_ID");

            Map<String, Object> properties = readSecrets(address, mount, path, roleId, secretId);
            if (!properties.isEmpty()) {
                environment.getPropertySources().addFirst(new MapPropertySource("vault-kv", properties));
            }
        } catch (Exception e) {
            if (failFast) {
                throw new IllegalStateException("Vault bootstrap failed", e);
            }
        }
    }

    private static Map<String, Object> readSecrets(String address, String mount, String path, String roleId, String secretId)
            throws IOException, InterruptedException {
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();

        Map<String, Object> loginPayload = Map.of(
                "role_id", roleId,
                "secret_id", secretId
        );

        HttpRequest loginRequest = HttpRequest.newBuilder()
                .uri(URI.create(normalize(address) + "/v1/auth/approle/login"))
                .timeout(Duration.ofSeconds(8))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(loginPayload)))
                .build();

        HttpResponse<String> loginResponse = client.send(loginRequest, HttpResponse.BodyHandlers.ofString());
        if (loginResponse.statusCode() < 200 || loginResponse.statusCode() >= 300) {
            throw new IllegalStateException("Vault AppRole login failed: HTTP " + loginResponse.statusCode());
        }

        Map<String, Object> loginJson = MAPPER.readValue(loginResponse.body(), new TypeReference<>() {});
        Map<String, Object> auth = asMap(loginJson.get("auth"));
        String token = String.valueOf(auth.get("client_token"));
        if (token == null || token.isBlank() || "null".equals(token)) {
            throw new IllegalStateException("Vault token missing after AppRole login");
        }

        String endpoint = normalize(address) + "/v1/" + mount + "/data/" + path;
        HttpRequest readRequest = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .timeout(Duration.ofSeconds(8))
                .header("X-Vault-Token", token)
                .GET()
                .build();

        HttpResponse<String> readResponse = client.send(readRequest, HttpResponse.BodyHandlers.ofString());
        if (readResponse.statusCode() < 200 || readResponse.statusCode() >= 300) {
            throw new IllegalStateException("Vault KV read failed: HTTP " + readResponse.statusCode());
        }

        Map<String, Object> readJson = MAPPER.readValue(readResponse.body(), new TypeReference<>() {});
        Map<String, Object> data = asMap(readJson.get("data"));
        Map<String, Object> values = asMap(data.get("data"));

        Map<String, Object> props = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : values.entrySet()) {
            props.put(entry.getKey(), entry.getValue());
        }
        return props;
    }

    private static String require(ConfigurableEnvironment environment, String propertyName, String envName) {
        String value = getProperty(environment, propertyName, envName, null);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Missing Vault setting: " + propertyName + " / " + envName);
        }
        return value;
    }

    private static String getProperty(ConfigurableEnvironment environment, String propertyName, String envName, String defaultValue) {
        String value = environment.getProperty(propertyName);
        if (value == null || value.isBlank()) {
            value = System.getenv(envName);
        }
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value;
    }

    private static String normalize(String address) {
        if (address.endsWith("/")) {
            return address.substring(0, address.length() - 1);
        }
        return address;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return Map.of();
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 20;
    }
}

