package com.icy.icy_backend.service.image;

import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;

/**
 * Téléchargement d'une image publique. Seuls http et https vers des adresses publiques sont acceptés,
 * redirections comprises, pour qu'un lien en base ne puisse pas faire appeler le réseau interne.
 */
@Component
public class ExternalImageFetcher {

    static final long MAX_BYTES = 20_000_000;
    private static final int MAX_REDIRECTS = 3;

    private final HttpClient client = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NEVER)
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public byte[] fetch(URI uri) throws IOException {
        URI current = uri;
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            checkPublic(current);
            HttpRequest request = HttpRequest.newBuilder(current)
                    .timeout(Duration.ofSeconds(30))
                    .header("User-Agent", "IceForge-image-import/1.0")
                    .header("Accept", "image/avif,image/webp,image/png,image/jpeg,image/gif")
                    .GET().build();
            HttpResponse<InputStream> response;
            try {
                response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IOException("téléchargement interrompu", e);
            }
            int status = response.statusCode();
            if (status >= 300 && status < 400) {
                response.body().close();
                String location = response.headers().firstValue("Location")
                        .orElseThrow(() -> new IOException("redirection sans destination"));
                current = current.resolve(location);
                continue;
            }
            try (InputStream body = response.body()) {
                if (status != 200) {
                    throw new IOException("réponse HTTP " + status);
                }
                byte[] content = body.readNBytes((int) MAX_BYTES + 1);
                if (content.length > MAX_BYTES) {
                    throw new IOException("image de plus de 20 Mo");
                }
                return content;
            }
        }
        throw new IOException("trop de redirections");
    }

    static void checkPublic(URI uri) throws IOException {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("https") && !scheme.equals("http")) {
            throw new IOException("protocole refusé");
        }
        if (uri.getHost() == null || (uri.getPort() != -1 && uri.getPort() != 80 && uri.getPort() != 443)) {
            throw new IOException("adresse refusée");
        }
        for (InetAddress address : InetAddress.getAllByName(uri.getHost())) {
            if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                    || address.isSiteLocalAddress() || address.isMulticastAddress()
                    || isUniqueLocalV6(address)) {
                throw new IOException("adresse privée refusée");
            }
        }
    }

    private static boolean isUniqueLocalV6(InetAddress address) {
        byte[] bytes = address.getAddress();
        return bytes.length == 16 && (bytes[0] & 0xfe) == 0xfc;
    }
}
