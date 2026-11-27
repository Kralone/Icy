package com.icy.icy_backend.service.image;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.URI;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ExternalImageFetcherTest {

    @Test
    void refusesInternalAddressesAndOtherProtocols() {
        for (String url : new String[]{"http://127.0.0.1/a.png", "http://10.0.0.5/a.png", "http://192.168.1.2/a.png",
                "http://169.254.169.254/latest", "http://[::1]/a.png", "http://localhost/a.png",
                "https://example.com:8443/a.png", "file:///etc/passwd", "ftp://example.com/a.png"}) {
            assertThatThrownBy(() -> ExternalImageFetcher.checkPublic(URI.create(url)))
                    .as(url).isInstanceOf(IOException.class);
        }
    }
}
