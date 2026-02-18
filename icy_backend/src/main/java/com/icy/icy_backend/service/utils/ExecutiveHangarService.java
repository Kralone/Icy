package com.icy.icy_backend.service.utils;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.utils.ExecutiveHangarConfigDTO;
import com.icy.icy_backend.controller.dto.utils.ExecutiveHangarPlayerStatusDTO;
import com.icy.icy_backend.db.entity.utils.ExecutiveHangarConfig;
import com.icy.icy_backend.db.entity.utils.ExecutiveHangarPlayerStatus;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.db.repository.utils.ExecutiveHangarConfigRepository;
import com.icy.icy_backend.db.repository.utils.ExecutiveHangarPlayerStatusRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.service.common.MessageService;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
public class ExecutiveHangarService {
    private static final short SINGLE_CONFIG_ID = 1;
    // Reference shared publicly (originally -05:00). Store as an instant.
    private static final OffsetDateTime DEFAULT_NEXT_ONLINE = OffsetDateTime.parse("2026-02-01T17:09:54.775-05:00");

    private final ExecutiveHangarConfigRepository configRepository;
    private final ExecutiveHangarPlayerStatusRepository playerStatusRepository;
    private final UserRepository userRepository;
    private final MessageService messageService;

    public ExecutiveHangarService(
            ExecutiveHangarConfigRepository configRepository,
            ExecutiveHangarPlayerStatusRepository playerStatusRepository,
            UserRepository userRepository,
            MessageService messageService
    ) {
        this.configRepository = configRepository;
        this.playerStatusRepository = playerStatusRepository;
        this.userRepository = userRepository;
        this.messageService = messageService;
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<ExecutiveHangarConfigDTO>> getConfig() {
        ExecutiveHangarConfig config = getOrCreateConfig();
        return messageService.buildResponse("exec.hangar.config.get", new ExecutiveHangarConfigDTO(config));
    }

    @Transactional
    public ResponseEntity<MessageResponse<ExecutiveHangarConfigDTO>> setNextOnline(OffsetDateTime nextOnlineAt, UUID actorId) {
        if (nextOnlineAt == null) {
            return messageService.buildResponse("exec.hangar.invalid", null, "nextOnlineAt est obligatoire.");
        }

        if (!nextOnlineAt.isAfter(OffsetDateTime.now())) {
            return messageService.buildResponse("exec.hangar.invalid", null, "La date doit etre dans le futur.");
        }

        ExecutiveHangarConfig config = getOrCreateConfig();
        config.setInitialOpenTime(nextOnlineAt.withOffsetSameInstant(ZoneOffset.UTC));
        config.setUpdatedByUserId(actorId);
        ExecutiveHangarConfig saved = configRepository.save(config);
        return messageService.buildResponse("exec.hangar.config.updated", new ExecutiveHangarConfigDTO(saved));
    }

    @Transactional
    public ResponseEntity<MessageResponse<ExecutiveHangarConfigDTO>> resetConfig(UUID actorId) {
        ExecutiveHangarConfig config = getOrCreateConfig();
        config.setInitialOpenTime(DEFAULT_NEXT_ONLINE.withOffsetSameInstant(ZoneOffset.UTC));
        config.setUpdatedByUserId(actorId);
        ExecutiveHangarConfig saved = configRepository.save(config);
        return messageService.buildResponse("exec.hangar.config.reset", new ExecutiveHangarConfigDTO(saved));
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<ExecutiveHangarPlayerStatusDTO>>> getPlayerStatuses() {
        List<ExecutiveHangarPlayerStatusDTO> statuses = playerStatusRepository.findAllByOrderByUserIdAsc().stream()
                .map(ExecutiveHangarPlayerStatusDTO::new)
                .toList();
        return messageService.buildResponse("exec.hangar.players.get", statuses);
    }

    @Transactional
    public ResponseEntity<MessageResponse<ExecutiveHangarPlayerStatusDTO>> setPlayerStatus(UUID userId, boolean hasExecShip, UUID actorId) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("Utilisateur introuvable: " + userId);
        }

        if (!hasExecShip) {
            playerStatusRepository.deleteById(userId);
            ExecutiveHangarPlayerStatus removed = new ExecutiveHangarPlayerStatus(userId, false, OffsetDateTime.now(ZoneOffset.UTC), actorId);
            return messageService.buildResponse("exec.hangar.player.updated", new ExecutiveHangarPlayerStatusDTO(removed));
        }

        ExecutiveHangarPlayerStatus status = playerStatusRepository.findById(userId)
                .orElseGet(() -> new ExecutiveHangarPlayerStatus(userId, true, null, null));
        status.setHasExecShip(true);
        status.setUpdatedByUserId(actorId);
        ExecutiveHangarPlayerStatus saved = playerStatusRepository.save(status);
        return messageService.buildResponse("exec.hangar.player.updated", new ExecutiveHangarPlayerStatusDTO(saved));
    }

    private ExecutiveHangarConfig getOrCreateConfig() {
        return configRepository.findById(SINGLE_CONFIG_ID)
                .orElseGet(() -> configRepository.save(new ExecutiveHangarConfig(
                        SINGLE_CONFIG_ID,
                        DEFAULT_NEXT_ONLINE.withOffsetSameInstant(ZoneOffset.UTC),
                        null,
                        null,
                        null
                )));
    }
}
