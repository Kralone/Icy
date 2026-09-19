package com.icy.icy_backend.controller.dto.response.front;

import java.util.List;
import java.time.OffsetDateTime;

public record OreLocationDTO(
        Long id,
        String locationCode,
        String sourceUrl,
        String gameVersion,
        OffsetDateTime updatedAt,
        Integer users,
        Integer scans,
        Integer clusters,
        OreMetricRangeDTO clusterCount,
        OreMetricRangeDTO mass,
        OreMetricRangeDTO inst,
        OreMetricRangeDTO res,
        List<OreMixDTO> ores,
        String locationKey
) {
    public OreLocationDTO(Long id, String locationCode, String sourceUrl, String gameVersion,
            OffsetDateTime updatedAt, Integer users, Integer scans, Integer clusters,
            OreMetricRangeDTO clusterCount, OreMetricRangeDTO mass, OreMetricRangeDTO inst,
            OreMetricRangeDTO res, List<OreMixDTO> ores) {
        this(id, locationCode, sourceUrl, gameVersion, updatedAt, users, scans, clusters,
                clusterCount, mass, inst, res, ores, id == null ? "manual:" + locationCode : "manual:" + id);
    }
}
