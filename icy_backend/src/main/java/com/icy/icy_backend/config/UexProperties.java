package com.icy.icy_backend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "icy.uex")
public class UexProperties {
    private String baseUrl;
    private String apiKey;
    private int refreshAttempts = 3;
    private long retryDelayMillis = 2000;
}
