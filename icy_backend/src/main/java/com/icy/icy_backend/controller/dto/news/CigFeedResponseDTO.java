package com.icy.icy_backend.controller.dto.news;

import java.time.OffsetDateTime;
import java.util.List;

public record CigFeedResponseDTO(
        OffsetDateTime generatedAt,
        OffsetDateTime nextScheduledFetchAt,
        int sourceCount,
        int itemCount,
        List<CigRawEntryDTO> items,
        List<CigSourceFetchErrorDTO> errors
) {
}
