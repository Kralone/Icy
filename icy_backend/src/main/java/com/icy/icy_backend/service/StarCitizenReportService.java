package com.icy.icy_backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.config.OpenAIConfig;
import com.icy.icy_backend.db.entity.News;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class StarCitizenReportService {

    private final NewsService newsService;

    private static final Logger logger = LoggerFactory.getLogger(StarCitizenReportService.class);
    private final RestTemplate restTemplate = new RestTemplate();
    private final OpenAIConfig openAIConfig;

    private static final String OPENAI_URL = "https://api.openai.com/v1/responses";
    private static final String MODEL = "gpt-5-mini"; // modèle supportant web_search

    public StarCitizenReportService(NewsService newsService, OpenAIConfig openAIConfig) {
        this.newsService = newsService;
        this.openAIConfig = openAIConfig;
    }

    // 🔹 Planification automatique : chaque lundi à 15h27 (heure locale)
    @Scheduled(cron = "0 0 12 * * SAT", zone = "Europe/Paris")
    public String generateWeeklyReport() {
        logger.info("🔭 Génération du rapport Star Citizen avec web_search...");

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(openAIConfig.getApiKey());

            HttpEntity<String> request = buildRequest(headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    OPENAI_URL,
                    HttpMethod.POST,
                    request,
                    String.class
            );

            String result = response.getBody();

            String reportText = extractReportText(result);

            if (reportText == null || reportText.isBlank()) {
                logger.error("❌ Aucun texte de rapport détecté dans la réponse OpenAI !");
                return "Erreur : aucun contenu généré par OpenAI.";
            }

            logger.info("✅ Rapport généré avec succès !");
            logger.info(reportText);
            News news = new News();
            news.setContent(reportText);

            newsService.createHebdoReport(news);
            return reportText;

        } catch (Exception e) {
            logger.error("❌ Erreur lors de la génération du rapport Star Citizen", e);
            return "Erreur : " + e.getMessage();
        }
    }

    private static String extractReportText(String jsonResponse) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(jsonResponse);
            StringBuilder reportBuilder = new StringBuilder();

            for (JsonNode output : root.path("output")) {
                if ("message".equals(output.path("type").asText(""))) {
                    for (JsonNode content : output.path("content")) {
                        if ("output_text".equals(content.path("type").asText(""))) {
                            reportBuilder.append(content.path("text").asText(""));
                        }
                    }
                }
            }

            return reportBuilder.toString().trim();
        } catch (Exception e) {
            logger.error("Erreur lors de l’extraction du texte du rapport OpenAI", e);
            return null;
        }
    }

    private static HttpEntity<String> buildRequest(HttpHeaders headers) {
        String body = """
                {
                  "model": "%s",
                  "input": [
                    {
                      "role": "system",
                      "content": "Tu es un journaliste galactique concis et précis, spécialisé dans Star Citizen. Tu rédiges un rapport hebdomadaire immersif, en Markdown, ne dépassant JAMAIS 6000 caractères, en te basant sur les sources officielles et communautaires récentes. Ton style est clair, professionnel et narratif, sans t’adresser directement au lecteur."
                    },
                    {
                      "role": "user",
                      "content": "Recherche sur le web les actualités majeures de Star Citizen et Squadron 42 des 7 derniers jours (RSI, Spectrum, Roadmap CIG, Reddit, YouTube officiels, presse FR/EN). Résume-les en un rapport hebdomadaire Markdown avec ces sections :\\n\\n# Rapport Hebdomadaire Star Citizen\\n## Actualités Officielles\\n## Développements Techniques\\nReste en dessous de 6000 caractères au total."
                    }
                  ],
                  "tools": [
                    { "type": "web_search" }
                  ]
                }
                """.formatted(MODEL);

        return new HttpEntity<>(body, headers);
    }

}