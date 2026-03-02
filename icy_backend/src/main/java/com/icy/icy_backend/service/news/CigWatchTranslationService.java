package com.icy.icy_backend.service.news;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.config.OpenAIConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class CigWatchTranslationService {
    private static final Logger logger = LoggerFactory.getLogger(CigWatchTranslationService.class);
    private static final String OPENAI_URL = "https://api.openai.com/v1/responses";
    private static final String MODEL = "gpt-5-mini";

    private final OpenAIConfig openAIConfig;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public CigWatchTranslationService(OpenAIConfig openAIConfig) {
        this.openAIConfig = openAIConfig;
    }

    public TranslationResult translateToFrench(String title, String excerpt, String payload) {
        String sourceTitle = safe(title);
        String sourceExcerpt = safe(excerpt);
        String sourcePayload = safe(payload);

        String apiKey = openAIConfig.getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            return new TranslationResult(sourceTitle, sourceExcerpt, sourcePayload);
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);

            String requestBody = buildRequestBody(sourceTitle, sourceExcerpt, sourcePayload);
            ResponseEntity<String> response = restTemplate.exchange(
                    OPENAI_URL,
                    HttpMethod.POST,
                    new HttpEntity<>(requestBody, headers),
                    String.class
            );

            String responseBody = response.getBody();
            String outputText = extractOutputText(responseBody);
            if (outputText == null || outputText.isBlank()) {
                return new TranslationResult(sourceTitle, sourceExcerpt, sourcePayload);
            }

            JsonNode translated = objectMapper.readTree(outputText);
            String translatedTitle = coalesce(translated.path("title").asText(null), sourceTitle);
            String translatedExcerpt = coalesce(translated.path("excerpt").asText(null), sourceExcerpt);
            String translatedPayload = coalesce(translated.path("payload").asText(null), sourcePayload);
            return new TranslationResult(translatedTitle, translatedExcerpt, translatedPayload);
        } catch (Exception ex) {
            logger.warn("Traduction CIG impossible, fallback EN: {}", ex.getMessage());
            return new TranslationResult(sourceTitle, sourceExcerpt, sourcePayload);
        }
    }

    private String buildRequestBody(String title, String excerpt, String payload) {
        String systemPrompt = """
                Tu es un traducteur professionnel EN->FR.
                Tu traduis strictement les champs fournis en francais naturel.
                Regles:
                - conserver les liens, balises, noms propres, acronymes et chiffres.
                - ne rien inventer, ne rien resumer, ne rien omettre.
                - renvoyer UNIQUEMENT un JSON valide avec les cles: title, excerpt, payload.
                """;

        String userPrompt = """
                Traduis ce JSON en francais:
                {
                  "title": %s,
                  "excerpt": %s,
                  "payload": %s
                }
                Reponds strictement par un JSON.
                """.formatted(
                jsonStringLiteral(title),
                jsonStringLiteral(excerpt),
                jsonStringLiteral(payload)
        );

        return """
                {
                  "model": "%s",
                  "input": [
                    {"role": "system", "content": %s},
                    {"role": "user", "content": %s}
                  ]
                }
                """.formatted(
                MODEL,
                jsonStringLiteral(systemPrompt),
                jsonStringLiteral(userPrompt)
        );
    }

    private String extractOutputText(String jsonResponse) {
        if (jsonResponse == null || jsonResponse.isBlank()) {
            return null;
        }
        try {
            JsonNode root = objectMapper.readTree(jsonResponse);
            StringBuilder output = new StringBuilder();
            for (JsonNode node : root.path("output")) {
                if (!"message".equals(node.path("type").asText(""))) {
                    continue;
                }
                for (JsonNode content : node.path("content")) {
                    if ("output_text".equals(content.path("type").asText(""))) {
                        output.append(content.path("text").asText(""));
                    }
                }
            }
            return output.toString().trim();
        } catch (Exception ex) {
            logger.warn("Lecture de la reponse OpenAI impossible: {}", ex.getMessage());
            return null;
        }
    }

    private String jsonStringLiteral(String value) {
        try {
            return objectMapper.writeValueAsString(value == null ? "" : value);
        } catch (Exception ignored) {
            String fallback = value == null ? "" : value;
            return "\"" + fallback.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\"";
        }
    }

    private String coalesce(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value;
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    public record TranslationResult(
            String titleFr,
            String excerptFr,
            String payloadFr
    ) {
    }
}

