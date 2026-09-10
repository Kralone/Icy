package com.icy.icy_backend.service.news;

import org.jsoup.Jsoup;
import java.net.URI;
import java.util.Locale;
import java.util.regex.Pattern;

/** Extracts the image already present in a Comm-Link card, without fetching any remote page. */
final class CigWatchImages {
    private static final Pattern CSS_URL = Pattern.compile("url\\(\\s*(['\"]?)(.*?)\\1\\s*\\)", Pattern.CASE_INSENSITIVE);
    private CigWatchImages() {}
    static String fromCard(String html, String sourceLink) {
        if (html == null || sourceLink == null || !sourceLink.contains("/comm-link/")) return null;
        var document = Jsoup.parse(html, "https://robertsspaceindustries.com");
        for (var element : document.select(".background[style], [style*=background-image]")) {
            var matcher = CSS_URL.matcher(element.attr("style"));
            if (matcher.find()) {
                String image = trustedUrl(matcher.group(2));
                if (image != null) return image;
            }
        }
        for (var element : document.select("img[src], img[data-src]")) {
            String image = trustedUrl(element.hasAttr("data-src") ? element.attr("data-src") : element.attr("src"));
            if (image != null) return image;
        }
        return null;
    }
    private static String trustedUrl(String value) {
        try {
            URI uri = URI.create("https://robertsspaceindustries.com").resolve(value.trim());
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            if (!"https".equals(uri.getScheme()) || uri.getUserInfo() != null || uri.getPort() != -1
                    || !(host.equals("media.robertsspaceindustries.com") || host.equals("robertsspaceindustries.com")
                    || host.equals("www.robertsspaceindustries.com"))) return null;
            return uri.toASCIIString();
        } catch (IllegalArgumentException ex) { return null; }
    }
}
