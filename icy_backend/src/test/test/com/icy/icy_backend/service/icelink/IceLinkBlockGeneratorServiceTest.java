package com.icy.icy_backend.service.icelink;

import com.icy.icy_backend.db.entity.icelink.IceLinkBlock;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.db.repository.user.UserShipRepository;
import com.icy.icy_backend.service.event.EventService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

class IceLinkBlockGeneratorServiceTest {

    @Test
    void generateActivityContentReturnsEmptyMessageWhenNoEvents() {
        EventService eventService = Mockito.mock(EventService.class);
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        UserShipRepository userShipRepository = Mockito.mock(UserShipRepository.class);
        IceLinkBlockGeneratorService service = new IceLinkBlockGeneratorService(eventService, userRepository, userShipRepository);

        when(eventService.getEventsBetween(Mockito.any(), Mockito.any())).thenReturn(List.of());

        IceLinkBlock block = IceLinkBlock.builder().name("events").content("base").build();
        String content = service.generateDynamicContent(block);

        assertThat(content).contains("Aucune activité");
    }
}
