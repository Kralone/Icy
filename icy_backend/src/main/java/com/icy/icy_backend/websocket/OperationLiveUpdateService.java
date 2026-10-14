package com.icy.icy_backend.websocket;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Signale qu'une opération a changé (présence, affectation, groupe, vaisseau, briefing).
 * Le message ne porte que l'identifiant : chaque fiche ouverte relit ce que son lecteur a le droit de voir.
 * Envoyé après la validation en base, pour que la relecture voie la modification.
 */
@Service
public class OperationLiveUpdateService {
    static final String DESTINATION_PREFIX = "/topic/operations/";
    private final SimpMessagingTemplate messagingTemplate;

    public OperationLiveUpdateService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void changed(UUID operationId) {
        if (operationId == null) return;
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() { send(operationId); }
            });
        } else {
            send(operationId);
        }
    }

    private void send(UUID operationId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("operationId", operationId);
        payload.put("timestamp", System.currentTimeMillis());
        messagingTemplate.convertAndSend(DESTINATION_PREFIX + operationId, (Object) payload);
    }
}
