package com.icy.icy_backend.service.news;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class CigWatchImagesTest {
    @Test void extractsRsiCardBackgroundWithoutDownloadingIt() {
        assertThat(CigWatchImages.fromCard("<div class='background' style=\"background-image:url('https://media.robertsspaceindustries.com/example/channel_item_full.png');\"></div>",
                "https://robertsspaceindustries.com/en/comm-link/transmission/123"))
                .isEqualTo("https://media.robertsspaceindustries.com/example/channel_item_full.png");
    }
    @Test void doesNotUseTrackerAvatarsOrUntrustedImageSchemes() {
        assertThat(CigWatchImages.fromCard("<img src='https://media.robertsspaceindustries.com/avatar.jpg'>", "https://robertsspaceindustries.com/community/devtracker")).isNull();
        for (String value : new String[]{"javascript:alert(1)", "http://media.robertsspaceindustries.com/x.jpg", "https://media.robertsspaceindustries.com.evil.test/x.jpg"}) {
            assertThat(CigWatchImages.fromCard("<img src='" + value + "'>", "https://robertsspaceindustries.com/comm-link/transmission/123")).isNull();
        }
    }
}
