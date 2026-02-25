package com.icy.icy_backend.controller.dto.response.front;

import java.util.List;

public record OreLocationDTO(
        Long id,
        String locationCode,
        Integer users,
        Integer scans,
        Integer clusters,
        OreMetricRangeDTO clusterCount,
        OreMetricRangeDTO mass,
        OreMetricRangeDTO inst,
        OreMetricRangeDTO res,
        List<OreMixDTO> ores
) {
}
