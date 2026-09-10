package com.icy.icy_backend.service.news;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import java.net.SocketTimeoutException;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class CigWatchTranslationServiceTest {
    private final CigWatchTranslationService service = new CigWatchTranslationService("http://libretranslate:5000/");
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(
            (RestTemplate) ReflectionTestUtils.getField(service, "restTemplate")).build();

    @Test void translatesAllFieldsInOneLocalRequest() {
        server.expect(requestTo("http://libretranslate:5000/translate"))
                .andExpect(method(org.springframework.http.HttpMethod.POST))
                .andExpect(headerDoesNotExist("Authorization"))
                .andExpect(content().json("{\"q\":[\"Mining\",\"Changes\",\"Details\"],\"source\":\"en\",\"target\":\"fr\",\"format\":\"text\"}"))
                .andRespond(withSuccess("{\"translatedText\":[\"Minage\",\"Modifications\",\"Détails\"]}", MediaType.APPLICATION_JSON));
        assertThat(service.translateToFrench("Mining", "Changes", "Details"))
                .isEqualTo(new CigWatchTranslationService.TranslationResult("Minage", "Modifications", "Détails"));
        server.verify();
    }

    @Test void omitsEmptyFieldsAndRestoresTheirPositions() {
        server.expect(requestTo("http://libretranslate:5000/translate"))
                .andExpect(content().json("{\"q\":[\"Mining\",\"Details\"],\"source\":\"en\",\"target\":\"fr\",\"format\":\"text\"}"))
                .andRespond(withSuccess("{\"translatedText\":[\"Minage\",\"Détails\"]}", MediaType.APPLICATION_JSON));
        assertThat(service.translateToFrench("Mining", null, "Details"))
                .isEqualTo(new CigWatchTranslationService.TranslationResult("Minage", "", "Détails"));
        server.verify();
    }

    @Test void missingUrlIsAnExplicitFailureNotAFrenchFallback() {
        var unconfigured = new CigWatchTranslationService("");
        assertThat(unconfigured.isConfigured()).isFalse();
        assertThatThrownBy(() -> unconfigured.translateToFrench("English", "", ""))
                .isInstanceOf(CigWatchTranslationService.TranslationException.class);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {
            "{\"translatedText\":[]}", "{\"translatedText\":[\"\"]}",
            "{\"translatedText\":\"Minage\"}", "{\"translatedText\":[42]}", "invalid JSON"})
    void invalidResponseDoesNotReuseEnglishSource(String response) {
        server.expect(requestTo("http://libretranslate:5000/translate"))
                .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> service.translateToFrench("Mining", "", ""))
                .isInstanceOf(CigWatchTranslationService.TranslationException.class)
                .hasMessageContaining("incomplète ou invalide");
        server.verify();
    }

    @Test void timeoutIsActionableAndDoesNotPublishEnglish() {
        server.expect(requestTo("http://libretranslate:5000/translate"))
                .andRespond(request -> { throw new SocketTimeoutException("Private network diagnostic"); });
        assertThatThrownBy(() -> service.translateToFrench("Mining", "", ""))
                .isInstanceOf(CigWatchTranslationService.TranslationException.class)
                .hasMessageContaining("délai de réponse LibreTranslate dépassé")
                .hasMessageNotContaining("Private network diagnostic");
        server.verify();
    }

    @Test void unauthorizedResponseExposesOnlyAnAllowlistedAction() {
        server.expect(requestTo("http://libretranslate:5000/translate"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.UNAUTHORIZED)
                        .body("Secret diagnostic must never be exposed"));
        assertThatThrownBy(() -> service.translateToFrench("English", "Excerpt", "Payload"))
                .isInstanceOf(CigWatchTranslationService.TranslationException.class)
                .hasMessageContaining("401/403")
                .hasMessageContaining("LibreTranslate")
                .hasMessageNotContaining("Secret diagnostic");
        server.verify();
    }
}
