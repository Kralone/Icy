package com.icy.icy_backend.service.news;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class StarCitizenReportServiceTest {
    @Test void legacyWeeklyReportCannotPublishCommunitySummaries() {
        assertThat(new StarCitizenReportService().generateWeeklyReport()).contains("désactivé", "Comm-Link");
        assertThat(StarCitizenReportService.class.getDeclaredFields()).isEmpty();
    }
}
