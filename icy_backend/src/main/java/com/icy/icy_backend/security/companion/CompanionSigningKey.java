package com.icy.icy_backend.security.companion;

import com.nimbusds.jose.jwk.RSAKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateCrtKey;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;

/**
 * Clé de signature des jetons du compagnon. Seul IceForge détient la partie privée ; la partie publique est
 * publiée sur /api/oauth2/jwks pour que le service compagnon vérifie les jetons sans rien demander d'autre.
 */
final class CompanionSigningKey {
    private static final Logger log = LoggerFactory.getLogger(CompanionSigningKey.class);

    private CompanionSigningKey() {}

    static RSAKey load(String pem, String keyId) {
        if (pem == null || pem.isBlank()) {
            log.warn("Aucune clé de signature du compagnon configurée (ICY_COMPANION_AUTH_SIGNING_KEY) : "
                    + "clé jetable générée, les jetons du compagnon ne survivront pas à un redémarrage.");
            return generate(keyId);
        }
        try {
            RSAPrivateCrtKey privateKey = parsePrivateKey(pem);
            RSAPublicKey publicKey = (RSAPublicKey) KeyFactory.getInstance("RSA")
                    .generatePublic(new RSAPublicKeySpec(privateKey.getModulus(), privateKey.getPublicExponent()));
            return new RSAKey.Builder(publicKey).privateKey(privateKey).keyID(keyId).build();
        } catch (Exception e) {
            throw new IllegalStateException("Clé de signature du compagnon illisible : PEM PKCS#8 RSA attendu "
                    + "(openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072).", e);
        }
    }

    static RSAPrivateCrtKey parsePrivateKey(String pem) throws Exception {
        String body = pem.replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replace("\\n", "")
                .replaceAll("\\s", "");
        byte[] der = Base64.getDecoder().decode(body);
        RSAPrivateKey key = (RSAPrivateKey) KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(der));
        if (!(key instanceof RSAPrivateCrtKey crt)) {
            throw new IllegalArgumentException("La clé privée doit contenir ses paramètres CRT (format PKCS#8 standard).");
        }
        return crt;
    }

    private static RSAKey generate(String keyId) {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(3072);
            KeyPair pair = generator.generateKeyPair();
            return new RSAKey.Builder((RSAPublicKey) pair.getPublic())
                    .privateKey((RSAPrivateKey) pair.getPrivate())
                    .keyID(keyId)
                    .build();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("RSA indisponible", e);
        }
    }
}
