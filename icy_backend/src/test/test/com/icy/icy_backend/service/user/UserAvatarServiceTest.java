package com.icy.icy_backend.service.user;

import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.service.image.ImageService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mockito;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Path;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UserAvatarServiceTest {

    @TempDir
    Path tempDir;

    @Test
    void storeAvatarRejectsUnsupportedType() throws Exception {
        ImageService imageService = Mockito.mock(ImageService.class);
        UserAvatarService service = new UserAvatarService(tempDir.toString(), "http://localhost/images/", imageService);
        User user = new User();
        user.setId(UUID.randomUUID());

        MockMultipartFile file = new MockMultipartFile("file", "test.txt", "text/plain", "data".getBytes());

        assertThatThrownBy(() -> service.storeAvatar(user, file))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void storeAvatarReturnsUrl() throws Exception {
        ImageService imageService = Mockito.mock(ImageService.class);
        UserAvatarService service = new UserAvatarService(tempDir.toString(), "http://localhost/images/", imageService);
        User user = new User();
        user.setId(UUID.randomUUID());

        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a});

        String url = service.storeAvatar(user, file);
        assertThat(url).contains("/avatars/");
    }
}
