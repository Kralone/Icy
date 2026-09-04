package com.icy.icy_backend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "icy.catalog-sync")
public class CatalogSyncProperties {
    private String wikiBaseUrl = "https://api.star-citizen.wiki/api";
    private int pageSize = 200;
    private long uexDelayMillis = 6500;
    private String userAgent = "IceForge/1.0 (https://iceforge.fr)";
}
