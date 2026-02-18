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

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

@Service
public class ExecutiveHangarService {
    private static final short SINGLE_CONFIG_ID = 1;
    private static final long OPEN_DURATION_MS = 3900338L;
    private static final long CLOSE_DURATION_MS = 7200623L;
    private static final long CYCLE_DURATION_MS = OPEN_DURATION_MS + CLOSE_DURATION_MS;
    private static final LocalDateTime DEFAULT_INITIAL_OPEN = LocalDateTime.of(2026, 2, 1, 17, 9, 54, 775_000_000);

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

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime target = LocalDateTime.ofInstant(nextOnlineAt.toInstant(), ZoneId.systemDefault());
        if (!target.isAfter(now)) {
            return messageService.buildResponse("exec.hangar.invalid", null, "La date doit etre dans le futur.");
        }

        long deltaMs = Duration.between(now, target).toMillis();
        long deltaInCycle = toPositiveModulo(deltaMs, CYCLE_DURATION_MS);
        long phaseInCycle = toPositiveModulo(CYCLE_DURATION_MS - deltaInCycle, CYCLE_DURATION_MS);
        LocalDateTime newInitialOpen = now.minus(Duration.ofMillis(phaseInCycle));

        ExecutiveHangarConfig config = getOrCreateConfig();
        config.setInitialOpenTime(newInitialOpen);
        config.setUpdatedByUserId(actorId);
        ExecutiveHangarConfig saved = configRepository.save(config);
        return messageService.buildResponse("exec.hangar.config.updated", new ExecutiveHangarConfigDTO(saved));
    }

    @Transactional
    public ResponseEntity<MessageResponse<ExecutiveHangarConfigDTO>> resetConfig(UUID actorId) {
        ExecutiveHangarConfig config = getOrCreateConfig();
        config.setInitialOpenTime(DEFAULT_INITIAL_OPEN);
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
            ExecutiveHangarPlayerStatus removed = new ExecutiveHangarPlayerStatus(userId, false, LocalDateTime.now(), actorId);
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
                        DEFAULT_INITIAL_OPEN,
                        null,
                        null,
                        null
                )));
    }

    private long toPositiveModulo(long value, long modulo) {
        long raw = value % modulo;
        return raw < 0 ? raw + modulo : raw;
    }
}
