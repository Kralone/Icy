package com.icy.icy_backend.service.news;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import java.util.ArrayList;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.ResourceAccessException;

@Service
public class CigWatchTranslationService {
    private static final Logger logger = LoggerFactory.getLogger(CigWatchTranslationService.class);

    private final String translationUrl;
    private final RestTemplate restTemplate = translationClient();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public CigWatchTranslationService(
            @Value("${cig.watch.translation-url:http://libretranslate:5000}") String translationUrl) {
        this.translationUrl = translationUrl == null ? "" : translationUrl.trim().replaceAll("/+$", "");
    }

    private static RestTemplate translationClient() {
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10000);
        factory.setReadTimeout(90000);
        return new RestTemplate(factory);
    }

    public boolean isConfigured() {
        return !translationUrl.isBlank();
    }

    public TranslationResult translateToFrench(String title, String excerpt, String payload) {
        if (!isConfigured()) throw new TranslationException(FailureCode.NOT_CONFIGURED);
        String[] sources = {safe(title), safe(excerpt), safe(payload)};
        String[] results = {"", "", ""};
        var texts = new ArrayList<String>();
        var positions = new ArrayList<Integer>();
        for (int i = 0; i < sources.length; i++) {
            if (!sources[i].isBlank()) {
                positions.add(i);
                texts.add(sources[i]);
            }
        }
        if (texts.isEmpty()) return new TranslationResult("", "", "");
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            String requestBody = objectMapper.writeValueAsString(Map.of(
                    "q", texts, "source", "en", "target", "fr", "format", "text"));
            ResponseEntity<String> response = restTemplate.exchange(
                    translationUrl + "/translate", HttpMethod.POST,
                    new HttpEntity<>(requestBody, headers), String.class);
            if (response.getBody() == null || response.getBody().isBlank()) {
                throw new TranslationException(FailureCode.INVALID_RESPONSE);
            }
            JsonNode translated = objectMapper.readTree(response.getBody()).path("translatedText");
            if (!translated.isArray() || translated.size() != texts.size()) {
                throw new TranslationException(FailureCode.INVALID_RESPONSE);
            }
            for (int i = 0; i < texts.size(); i++) {
                JsonNode value = translated.get(i);
                if (!value.isTextual() || value.asText().isBlank()) {
                    throw new TranslationException(FailureCode.INVALID_RESPONSE);
                }
                results[positions.get(i)] = value.asText().trim();
            }
            return new TranslationResult(results[0], results[1], results[2]);
        } catch (TranslationException ex) {
            throw ex;
        } catch (RestClientResponseException ex) {
            int status = ex.getStatusCode().value();
            logger.warn("Traduction CIG refusée (HTTP {})", status);
            throw new TranslationException(status == 401 || status == 403 ? FailureCode.ACCESS_DENIED
                    : status == 429 ? FailureCode.RATE_LIMITED : FailureCode.UNAVAILABLE);
        } catch (ResourceAccessException ex) {
            Throwable cause = ex;
            while (cause != null) {
                if (cause instanceof java.net.SocketTimeoutException || cause instanceof java.net.http.HttpTimeoutException) {
                    throw new TranslationException(FailureCode.TIMEOUT);
                }
                cause = cause.getCause();
            }
            throw new TranslationException(FailureCode.UNAVAILABLE);
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new TranslationException(FailureCode.INVALID_RESPONSE);
        } catch (Exception ex) {
            logger.warn("Traduction CIG indisponible ({})", ex.getClass().getSimpleName());
            throw new TranslationException(FailureCode.UNAVAILABLE);
        }
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

    public enum FailureCode {
        NOT_CONFIGURED("Traduction : configurez CIG_WATCH_TRANSLATION_URL sur le backend."),
        ACCESS_DENIED("Traduction : accès LibreTranslate refusé (401/403). Vérifiez la configuration du service local."),
        RATE_LIMITED("Traduction : limite LibreTranslate atteinte (429). Nouvelle tentative programmée."),
        TIMEOUT("Traduction : délai de réponse LibreTranslate dépassé. Nouvelle tentative programmée."),
        INVALID_RESPONSE("Traduction : réponse française incomplète ou invalide. Nouvelle tentative programmée."),
        UNAVAILABLE("Traduction : service LibreTranslate indisponible. Nouvelle tentative programmée.");

        private final String publicMessage;
        FailureCode(String publicMessage) { this.publicMessage = publicMessage; }
    }

    /** Contains only an allowlisted diagnosis, never API response bodies, credentials or remote exception causes. */
    public static final class TranslationException extends IllegalStateException {
        private final FailureCode code;
        public TranslationException(FailureCode code) {
            super(code.publicMessage);
            this.code = code;
        }
        public FailureCode getCode() { return code; }
    }
}

