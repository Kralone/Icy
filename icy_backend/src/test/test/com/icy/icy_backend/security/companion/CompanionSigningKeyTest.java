package com.icy.icy_backend.security.companion;

import com.nimbusds.jose.jwk.RSAKey;
import org.junit.jupiter.api.Test;

import java.security.KeyPairGenerator;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CompanionSigningKeyTest {

    @Test
    void loadsPkcs8PemAndDerivesPublicKey() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        var pair = generator.generateKeyPair();
        String pem = "-----BEGIN PRIVATE KEY-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes()).encodeToString(pair.getPrivate().getEncoded())
                + "\n-----END PRIVATE KEY-----\n";

        RSAKey key = CompanionSigningKey.load(pem, "kid-1");

        assertThat(key.getKeyID()).isEqualTo("kid-1");
        assertThat(key.toRSAPublicKey()).isEqualTo(pair.getPublic());
        assertThat(key.isPrivate()).isTrue();
    }

    @Test
    void generatesThrowawayKeyWhenNoneConfigured() {
        assertThat(CompanionSigningKey.load("", "dev").isPrivate()).isTrue();
    }

    @Test
    void rejectsGarbage() {
        assertThatThrownBy(() -> CompanionSigningKey.load("pas une clé", "kid")).isInstanceOf(IllegalStateException.class);
    }
}
