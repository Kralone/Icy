package com.icy.icy_backend.service.news;

import org.springframework.stereotype.Service;

/** Legacy entry point retained for callers; publication is exclusively handled by CIG Watch. */
@Service
public class StarCitizenReportService {
    public String generateWeeklyReport() {
        return "Rapport hebdomadaire désactivé. Consultez les actualités officielles Comm-Link dans CIG Watch.";
    }
}
