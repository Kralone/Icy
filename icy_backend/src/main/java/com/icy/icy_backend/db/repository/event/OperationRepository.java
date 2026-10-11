package com.icy.icy_backend.db.repository.event;

import com.icy.icy_backend.db.entity.event.Operation;
import org.springframework.data.repository.CrudRepository;

import java.util.UUID;

public interface OperationRepository extends CrudRepository<Operation, UUID> {
}
