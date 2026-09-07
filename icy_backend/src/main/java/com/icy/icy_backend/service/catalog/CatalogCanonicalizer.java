package com.icy.icy_backend.service.catalog;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

final class CatalogCanonicalizer {
    private static final Pattern EDITION_SUFFIX = Pattern.compile(
            "\\s+(?:" +
                    "\\d{4}\\s+best\\s+in\\s+show\\s+edition|" +
                    "\\d{4}\\s+bis|" +
                    "citizencon\\s+\\d{4}\\s+edition|" +
                    "executive\\s+edition|" +
                    "pyam\\s+exec|" +
                    "wikelo(?:\\s+(?:war|sneak|work|speedy|savior))?\\s+special|" +
                    "alliance|pirate|emerald|renegade|valiant|expedition|comet" +
                    ")$",
            Pattern.CASE_INSENSITIVE
    );
    private static final Map<String, String> EDITION_ALIASES = Map.of(
            "mustang citizencon 2948 edition", "mustang alpha",
            "f7c hornet wildfire mk i", "f7c hornet mk i",
            "f7c-m hornet heartseeker mk i", "f7c-m super hornet mk i",
            "f7c-m hornet heartseeker mk ii", "f7c-m super hornet mk ii",
            "f7 hornet mk wikelo", "f7c hornet mk ii",
            "hornet f7a mk ii", "f7a hornet mk ii"
    );

    private CatalogCanonicalizer() {
    }

    static String vehicleKey(String family, String manufacturer, String name) {
        return normalize(family) + "|" + normalize(manufacturer) + "|" + canonicalVehicleName(name);
    }

    static String canonicalVehicleName(String name) {
        String normalized = normalize(name);
        String alias = EDITION_ALIASES.get(normalized);
        if (alias != null) return alias;
        String previous;
        do {
            previous = normalized;
            normalized = EDITION_SUFFIX.matcher(normalized).replaceFirst("").strip();
        } while (!normalized.equals(previous));
        return EDITION_ALIASES.getOrDefault(normalized, normalized);
    }

    private static String normalize(String value) {
        if (value == null) return "";
        String decomposed = Normalizer.normalize(value, Normalizer.Form.NFKD)
                .replaceAll("\\p{M}+", "");
        return decomposed.toLowerCase(Locale.ROOT).trim().replaceAll("\\s+", " ");
    }
}
