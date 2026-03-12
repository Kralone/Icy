package com.icy.icy_backend.service.mining;

import com.icy.icy_backend.controller.dto.mining.MiningSheetCreateRequest;
import com.icy.icy_backend.controller.dto.mining.MiningSheetJobOreRequest;
import com.icy.icy_backend.controller.dto.mining.MiningSheetJobUpsertRequest;
import com.icy.icy_backend.controller.dto.mining.MiningSheetUpdateRequest;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.front.UexResourceSaleDTO;
import com.icy.icy_backend.controller.dto.response.mining.*;
import com.icy.icy_backend.db.entity.mining.*;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.entity.user.UserRole;
import com.icy.icy_backend.db.repository.mining.MiningSheetRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ForbiddenException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.uex.UexDatasetService;
import com.icy.icy_backend.websocket.MiningSheetWebSocketService;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@Transactional
public class MiningSheetService {
    private static final DateTimeFormatter SHEET_NAME_TIME_FORMATTER = DateTimeFormatter.ofPattern("dd/MM HH:mm");
    private final MiningSheetRepository miningSheetRepository;
    private final UserRepository userRepository;
    private final UexDatasetService uexDatasetService;
    private final MiningSheetWebSocketService miningSheetWebSocketService;

    public MiningSheetService(
            MiningSheetRepository miningSheetRepository,
            UserRepository userRepository,
            UexDatasetService uexDatasetService,
            MiningSheetWebSocketService miningSheetWebSocketService
    ) {
        this.miningSheetRepository = miningSheetRepository;
        this.userRepository = userRepository;
        this.uexDatasetService = uexDatasetService;
        this.miningSheetWebSocketService = miningSheetWebSocketService;
    }

    @Transactional(readOnly = true)
    public List<MiningSheetDTO> listSheets() {
        UUID currentUserId = AuthUtils.getCurrentUserId();
        boolean admin = AuthUtils.isAdmin();

        return miningSheetRepository.findAllWithDetails().stream()
                .map(sheet -> toDto(sheet, currentUserId, admin))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<String> suggestSaleLocations(String query) {
        return uexDatasetService.suggestSaleTerminals(query, 15);
    }

    public MiningSheetDTO createSheet(MiningSheetCreateRequest request) {
        validateSheetRequest(request.operationDate(), request.refineryLocation(), request.memberIds());

        UUID currentUserId = AuthUtils.getCurrentUserId();
        User creator = findUser(currentUserId);
        LocalDateTime now = LocalDateTime.now();

        MiningSheet sheet = new MiningSheet();
        sheet.setSheetName(resolveSheetName(request.sheetName(), now));
        sheet.setOperationDate(request.operationDate());
        sheet.setRefineryLocation(normalizeText(request.refineryLocation()));
        sheet.setSaleLocation(normalizeNullableText(request.saleLocation()));
        sheet.setCreatedBy(creator);
        sheet.setStatus(MiningSheetStatus.OPEN);
        replaceMembers(sheet, request.memberIds());

        MiningSheet saved = miningSheetRepository.save(sheet);
        MiningSheet reloaded = loadSheet(saved.getId());
        MiningSheetDTO dto = toDto(reloaded, currentUserId, true);
        miningSheetWebSocketService.broadcast("SHEET_CREATED", saved.getId());
        return dto;
    }

    public MiningSheetDTO updateSheet(UUID sheetId, MiningSheetUpdateRequest request) {
        validateSheetRequest(request.operationDate(), request.refineryLocation(), request.memberIds());

        UUID currentUserId = AuthUtils.getCurrentUserId();
        MiningSheet sheet = loadSheet(sheetId);
        ensureSheetIsOpen(sheet);

        Set<UUID> newMemberIds = normalizeUserIds(request.memberIds());
        Set<UUID> jobOwnerIds = sheet.getJobs().stream()
                .map(MiningSheetJob::getOwnerUser)
                .filter(Objects::nonNull)
                .map(User::getId)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        if (!newMemberIds.containsAll(jobOwnerIds)) {
            throw new BadRequestException("Impossible de retirer un membre possedant deja des jobs.");
        }

        sheet.setSheetName(resolveSheetName(request.sheetName(), sheet.getCreatedAt()));
        sheet.setOperationDate(request.operationDate());
        sheet.setRefineryLocation(normalizeText(request.refineryLocation()));
        sheet.setSaleLocation(normalizeNullableText(request.saleLocation()));
        replaceMembers(sheet, request.memberIds());

        MiningSheet saved = miningSheetRepository.save(sheet);
        MiningSheet reloaded = loadSheet(saved.getId());
        MiningSheetDTO dto = toDto(reloaded, currentUserId, true);
        miningSheetWebSocketService.broadcast("SHEET_UPDATED", saved.getId());
        return dto;
    }

    public MiningSheetDTO lockSheet(UUID sheetId) {
        UUID currentUserId = AuthUtils.getCurrentUserId();
        MiningSheet sheet = loadSheet(sheetId);
        if (sheet.getStatus() == MiningSheetStatus.FINALIZED) {
            throw new BadRequestException("Une fiche finalisee ne peut plus etre verrouillee.");
        }
        sheet.setStatus(MiningSheetStatus.LOCKED);
        MiningSheet saved = miningSheetRepository.save(sheet);
        MiningSheetDTO dto = toDto(loadSheet(saved.getId()), currentUserId, true);
        miningSheetWebSocketService.broadcast("SHEET_LOCKED", saved.getId());
        return dto;
    }

    public MiningSheetDTO unlockSheet(UUID sheetId) {
        UUID currentUserId = AuthUtils.getCurrentUserId();
        MiningSheet sheet = loadSheet(sheetId);
        if (sheet.getStatus() == MiningSheetStatus.FINALIZED) {
            throw new BadRequestException("Une fiche finalisee ne peut pas etre deverrouillee.");
        }
        sheet.setStatus(MiningSheetStatus.OPEN);
        MiningSheet saved = miningSheetRepository.save(sheet);
        MiningSheetDTO dto = toDto(loadSheet(saved.getId()), currentUserId, true);
        miningSheetWebSocketService.broadcast("SHEET_UNLOCKED", saved.getId());
        return dto;
    }

    public MiningSheetDTO finalizeSheet(UUID sheetId) {
        UUID currentUserId = AuthUtils.getCurrentUserId();
        MiningSheet sheet = loadSheet(sheetId);
        if (sheet.getStatus() != MiningSheetStatus.LOCKED) {
            throw new BadRequestException("Une fiche doit etre verrouillee avant finalisation.");
        }
        sheet.setStatus(MiningSheetStatus.FINALIZED);
        MiningSheet saved = miningSheetRepository.save(sheet);
        MiningSheetDTO dto = toDto(loadSheet(saved.getId()), currentUserId, true);
        miningSheetWebSocketService.broadcast("SHEET_FINALIZED", saved.getId());
        return dto;
    }

    public MiningSheetDTO createJob(UUID sheetId, MiningSheetJobUpsertRequest request) {
        UUID currentUserId = AuthUtils.getCurrentUserId();
        boolean admin = AuthUtils.isAdmin();

        MiningSheet sheet = loadSheet(sheetId);
        ensureCanEditSheet(sheet, currentUserId, admin);

        MiningSheetJobType type = resolveJobType(request.type(), null);
        UUID ownerUserId = resolveOwnerUserId(sheet, currentUserId, currentUserId, admin);

        MiningSheetJob job = new MiningSheetJob();
        job.setSheet(sheet);
        job.setOwnerUser(findUser(ownerUserId));
        job.setType(type);
        applyJobPayload(job, type, request, admin, true);

        sheet.getJobs().add(job);
        MiningSheet saved = miningSheetRepository.save(sheet);
        MiningSheetDTO dto = toDto(loadSheet(saved.getId()), currentUserId, admin);
        miningSheetWebSocketService.broadcast("JOB_CREATED", saved.getId());
        return dto;
    }

    public MiningSheetDTO updateJob(UUID sheetId, UUID jobId, MiningSheetJobUpsertRequest request) {
        UUID currentUserId = AuthUtils.getCurrentUserId();
        boolean admin = AuthUtils.isAdmin();

        MiningSheet sheet = loadSheet(sheetId);
        ensureCanEditSheet(sheet, currentUserId, admin);

        MiningSheetJob job = findJob(sheet, jobId);
        if (!admin && !job.getOwnerUser().getId().equals(currentUserId)) {
            throw new ForbiddenException("Vous ne pouvez modifier que vos propres jobs.");
        }

        MiningSheetJobType type = resolveJobType(request.type(), job.getType());
        job.setType(type);

        if (admin && request.ownerUserId() != null) {
            UUID ownerUserId = resolveOwnerUserId(sheet, request.ownerUserId(), currentUserId, true);
            job.setOwnerUser(findUser(ownerUserId));
        }

        applyJobPayload(job, type, request, admin, false);
        MiningSheet saved = miningSheetRepository.save(sheet);
        MiningSheetDTO dto = toDto(loadSheet(saved.getId()), currentUserId, admin);
        miningSheetWebSocketService.broadcast("JOB_UPDATED", saved.getId());
        return dto;
    }

    public MiningSheetDTO deleteJob(UUID sheetId, UUID jobId) {
        UUID currentUserId = AuthUtils.getCurrentUserId();
        boolean admin = AuthUtils.isAdmin();

        MiningSheet sheet = loadSheet(sheetId);
        ensureCanEditSheet(sheet, currentUserId, admin);

        MiningSheetJob job = findJob(sheet, jobId);
        if (!admin && !job.getOwnerUser().getId().equals(currentUserId)) {
            throw new ForbiddenException("Vous ne pouvez supprimer que vos propres jobs.");
        }

        sheet.getJobs().removeIf(existing -> existing.getId().equals(jobId));
        MiningSheet saved = miningSheetRepository.save(sheet);
        MiningSheetDTO dto = toDto(loadSheet(saved.getId()), currentUserId, admin);
        miningSheetWebSocketService.broadcast("JOB_DELETED", saved.getId());
        return dto;
    }

    private void validateSheetRequest(java.time.LocalDate operationDate, String refineryLocation, List<UUID> memberIds) {
        if (operationDate == null) {
            throw new BadRequestException("La date de l'operation est obligatoire.");
        }
        if (refineryLocation == null || refineryLocation.isBlank()) {
            throw new BadRequestException("Le lieu de raffinage est obligatoire.");
        }
        if (memberIds == null || memberIds.isEmpty()) {
            throw new BadRequestException("Vous devez ajouter au moins un membre.");
        }
    }

    private MiningSheet loadSheet(UUID sheetId) {
        return miningSheetRepository.findByIdWithDetails(sheetId)
                .orElseThrow(() -> new ResourceNotFoundException("Fiche de minage introuvable."));
    }

    private MiningSheetJob findJob(MiningSheet sheet, UUID jobId) {
        return sheet.getJobs().stream()
                .filter(job -> job.getId().equals(jobId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Job introuvable."));
    }

    private void ensureCanEditSheet(MiningSheet sheet, UUID currentUserId, boolean admin) {
        ensureSheetIsOpen(sheet);
        if (admin) {
            return;
        }
        boolean isMember = sheet.getMembers().stream()
                .map(MiningSheetMember::getUser)
                .filter(Objects::nonNull)
                .map(User::getId)
                .anyMatch(currentUserId::equals);
        if (!isMember) {
            throw new ForbiddenException("Cette fiche est reservee aux membres assignes.");
        }
    }

    private void ensureSheetIsOpen(MiningSheet sheet) {
        if (sheet.getStatus() != MiningSheetStatus.OPEN) {
            throw new BadRequestException("La fiche est verrouillee ou finalisee.");
        }
    }

    private UUID resolveOwnerUserId(MiningSheet sheet, UUID requestedOwnerUserId, UUID currentUserId, boolean admin) {
        UUID ownerUserId = requestedOwnerUserId == null ? currentUserId : requestedOwnerUserId;
        boolean ownerIsMember = sheet.getMembers().stream()
                .map(MiningSheetMember::getUser)
                .filter(Objects::nonNull)
                .map(User::getId)
                .anyMatch(ownerUserId::equals);
        if (!ownerIsMember) {
            throw new BadRequestException("Le proprietaire du job doit etre membre de la fiche.");
        }
        if (!admin && !ownerUserId.equals(currentUserId)) {
            throw new ForbiddenException("Vous ne pouvez pas selectionner un autre proprietaire.");
        }
        return ownerUserId;
    }

    private void replaceMembers(MiningSheet sheet, List<UUID> rawMemberIds) {
        Set<UUID> memberIds = normalizeUserIds(rawMemberIds);
        if (memberIds.isEmpty()) {
            throw new BadRequestException("La fiche doit contenir au moins un membre.");
        }

        Map<UUID, User> usersById = new LinkedHashMap<>();
        for (User user : userRepository.findAllById(memberIds)) {
            usersById.put(user.getId(), user);
        }

        if (usersById.size() != memberIds.size()) {
            throw new BadRequestException("Un ou plusieurs membres sont introuvables.");
        }

        Map<UUID, MiningSheetMember> existingByUserId = new LinkedHashMap<>();
        for (MiningSheetMember member : sheet.getMembers()) {
            UUID userId = member.getUser() == null ? null : member.getUser().getId();
            if (userId != null && !existingByUserId.containsKey(userId)) {
                existingByUserId.put(userId, member);
            }
        }

        sheet.getMembers().removeIf(member -> {
            UUID userId = member.getUser() == null ? null : member.getUser().getId();
            return userId == null || !memberIds.contains(userId);
        });

        for (UUID memberId : memberIds) {
            if (existingByUserId.containsKey(memberId)) {
                continue;
            }
            MiningSheetMember member = new MiningSheetMember();
            member.setSheet(sheet);
            member.setUser(usersById.get(memberId));
            sheet.getMembers().add(member);
        }
    }

    private Set<UUID> normalizeUserIds(List<UUID> rawMemberIds) {
        Set<UUID> memberIds = new LinkedHashSet<>();
        if (rawMemberIds == null) {
            return memberIds;
        }
        for (UUID memberId : rawMemberIds) {
            if (memberId != null) {
                memberIds.add(memberId);
            }
        }
        return memberIds;
    }

    private void applyJobPayload(
            MiningSheetJob job,
            MiningSheetJobType type,
            MiningSheetJobUpsertRequest request,
            boolean allowTimerEdit,
            boolean creating
    ) {
        job.setCostAuec(safePositiveInt(request.costAuec()));
        job.setNotes(normalizeNullableText(request.notes()));

        if (type != MiningSheetJobType.REFINERY) {
            job.setRefineryMethod(null);
            if (allowTimerEdit || creating) {
                job.setDurationMinutes(null);
                job.setPublishedAt(null);
                job.setFinishAt(null);
            }
            job.getOres().clear();
            return;
        }

        job.setRefineryMethod(normalizeNullableText(request.refineryMethod()));
        updateRefineryTimer(job, request, allowTimerEdit, creating);
        replaceJobOres(job, request.ores());
    }

    private void updateRefineryTimer(
            MiningSheetJob job,
            MiningSheetJobUpsertRequest request,
            boolean allowTimerEdit,
            boolean creating
    ) {
        if (allowTimerEdit || creating) {
            Integer duration = request.durationMinutes();
            if (duration != null && duration < 0) {
                throw new BadRequestException("La duree de raffinage ne peut pas etre negative.");
            }

            job.setDurationMinutes(duration);
            if (duration == null || duration == 0) {
                job.setPublishedAt(null);
                job.setFinishAt(null);
                return;
            }

            LocalDateTime publishedAt = request.publishedAt();
            if (publishedAt == null) {
                publishedAt = creating ? LocalDateTime.now() : job.getPublishedAt();
            }
            if (publishedAt == null) {
                publishedAt = LocalDateTime.now();
            }

            job.setPublishedAt(publishedAt);
            job.setFinishAt(publishedAt.plusMinutes(duration));
        }
    }

    private void replaceJobOres(MiningSheetJob job, List<MiningSheetJobOreRequest> oreRequests) {
        if (oreRequests == null || oreRequests.isEmpty()) {
            throw new BadRequestException("Un job de raffinage doit contenir au moins un minerai.");
        }

        List<MiningSheetJobOre> parsedOres = new ArrayList<>();
        for (MiningSheetJobOreRequest oreRequest : oreRequests) {
            String oreName = normalizeText(oreRequest.oreName());
            double quantity = oreRequest.quantityCscu() == null ? 0d : oreRequest.quantityCscu();
            if (oreName.isBlank()) {
                throw new BadRequestException("Le nom de minerai est obligatoire.");
            }
            if (!Double.isFinite(quantity) || quantity <= 0d) {
                throw new BadRequestException("La quantite de minerai doit etre positive.");
            }

            MiningSheetJobOre ore = new MiningSheetJobOre();
            ore.setJob(job);
            ore.setOreName(oreName);
            ore.setQuantityCscu(BigDecimal.valueOf(quantity));
            ore.setIncludeInSale(!Boolean.FALSE.equals(oreRequest.includeInSale()));
            parsedOres.add(ore);
        }

        job.getOres().clear();
        job.getOres().addAll(parsedOres);
    }

    private MiningSheetJobType resolveJobType(String rawType, MiningSheetJobType fallback) {
        String candidate = rawType == null ? "" : rawType.trim();
        if (candidate.isBlank()) {
            if (fallback != null) {
                return fallback;
            }
            throw new BadRequestException("Le type de job est obligatoire.");
        }
        try {
            return MiningSheetJobType.valueOf(candidate.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Type de job invalide: " + candidate);
        }
    }

    private MiningSheetDTO toDto(MiningSheet sheet, UUID currentUserId, boolean admin) {
        boolean sheetIsOpen = sheet.getStatus() == MiningSheetStatus.OPEN;
        boolean userIsMember = sheet.getMembers().stream()
                .map(MiningSheetMember::getUser)
                .filter(Objects::nonNull)
                .map(User::getId)
                .anyMatch(currentUserId::equals);

        List<MiningSheetUserDTO> members = sheet.getMembers().stream()
                .map(MiningSheetMember::getUser)
                .filter(Objects::nonNull)
                .map(this::toUserDto)
                .sorted(Comparator.comparing(MiningSheetUserDTO::username, String.CASE_INSENSITIVE_ORDER))
                .toList();

        List<MiningSheetJobDTO> jobs = sheet.getJobs().stream()
                .sorted(Comparator.comparing(MiningSheetJob::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(job -> toJobDto(job, currentUserId, admin, userIsMember, sheetIsOpen))
                .toList();

        return new MiningSheetDTO(
                sheet.getId(),
                sheet.getSheetName(),
                sheet.getOperationDate(),
                sheet.getRefineryLocation(),
                sheet.getSaleLocation(),
                sheet.getStatus().name(),
                sheet.getCreatedAt(),
                sheet.getUpdatedAt(),
                toUserDto(sheet.getCreatedBy()),
                members,
                jobs,
                buildSummary(sheet),
                sheetIsOpen && userIsMember,
                admin
        );
    }

    private MiningSheetJobDTO toJobDto(
            MiningSheetJob job,
            UUID currentUserId,
            boolean admin,
            boolean userIsMember,
            boolean sheetIsOpen
    ) {
        boolean editableByCurrentUser = sheetIsOpen && (admin || (userIsMember && job.getOwnerUser().getId().equals(currentUserId)));
        boolean timerEditableByCurrentUser = sheetIsOpen && admin;

        List<MiningSheetJobOreDTO> ores = job.getOres().stream()
                .map(ore -> new MiningSheetJobOreDTO(
                        ore.getId(),
                        ore.getOreName(),
                        roundCscu(ore.getQuantityCscu()),
                        toScu(ore.getQuantityCscu()),
                        !Boolean.FALSE.equals(ore.getIncludeInSale())
                ))
                .toList();

        return new MiningSheetJobDTO(
                job.getId(),
                job.getType().name(),
                toUserDto(job.getOwnerUser()),
                job.getRefineryMethod(),
                job.getDurationMinutes(),
                safePositiveInt(job.getCostAuec()),
                job.getPublishedAt(),
                job.getFinishAt(),
                job.getFinishAt() == null ? null : Math.max(0L, Duration.between(LocalDateTime.now(), job.getFinishAt()).toSeconds()),
                job.getNotes(),
                ores,
                editableByCurrentUser,
                timerEditableByCurrentUser
        );
    }

    private MiningSheetSummaryDTO buildSummary(MiningSheet sheet) {
        Map<String, OreAccumulator> oreByName = new LinkedHashMap<>();
        Map<String, OreAccumulator> keptOreByName = new LinkedHashMap<>();
        Map<UUID, UserMaterialAccumulator> materialsByUser = new LinkedHashMap<>();
        Map<UUID, Long> paidCostsByUser = new LinkedHashMap<>();
        Set<UUID> participantIds = new LinkedHashSet<>();
        Map<UUID, User> participantUsers = new LinkedHashMap<>();
        Set<String> saleNames = new LinkedHashSet<>();

        long totalCosts = 0L;
        long longestRemainingSeconds = 0L;
        LocalDateTime now = LocalDateTime.now();

        for (MiningSheetMember member : sheet.getMembers()) {
            if (member.getUser() != null) {
                participantIds.add(member.getUser().getId());
                participantUsers.put(member.getUser().getId(), member.getUser());
            }
        }

        for (MiningSheetJob job : sheet.getJobs()) {
            User owner = job.getOwnerUser();
            if (owner == null) {
                continue;
            }
            UUID ownerId = owner.getId();
            participantIds.add(ownerId);
            participantUsers.put(ownerId, owner);

            long jobCost = safePositiveInt(job.getCostAuec());
            totalCosts += jobCost;
            paidCostsByUser.merge(ownerId, jobCost, Long::sum);

            if (job.getType() != MiningSheetJobType.REFINERY) {
                continue;
            }

            if (job.getFinishAt() != null) {
                long remaining = Duration.between(now, job.getFinishAt()).toSeconds();
                if (remaining > longestRemainingSeconds) {
                    longestRemainingSeconds = remaining;
                }
            }

            UserMaterialAccumulator materialAccumulator = materialsByUser.computeIfAbsent(
                    ownerId,
                    id -> new UserMaterialAccumulator(owner)
            );

            for (MiningSheetJobOre ore : job.getOres()) {
                String oreName = normalizeText(ore.getOreName());
                if (oreName.isBlank()) {
                    continue;
                }

                double cscu = safePositiveDouble(ore.getQuantityCscu());
                if (cscu <= 0d) {
                    continue;
                }

                long scu = toScu(cscu);
                boolean includeInSale = !Boolean.FALSE.equals(ore.getIncludeInSale());
                UserOreAccumulator userOreAccumulator = materialAccumulator.oresByName.computeIfAbsent(
                        normalizeKey(oreName),
                        key -> new UserOreAccumulator(oreName)
                );
                userOreAccumulator.totalCscu += cscu;
                userOreAccumulator.totalScu += scu;
                materialAccumulator.totalScu += scu;

                if (!includeInSale) {
                    OreAccumulator keptAccumulator = keptOreByName.computeIfAbsent(
                            normalizeKey(oreName),
                            key -> new OreAccumulator(oreName)
                    );
                    keptAccumulator.totalCscu += cscu;
                    keptAccumulator.totalScu += scu;
                    continue;
                }

                UserOreAccumulator soldUserOreAccumulator = materialAccumulator.soldOresByName.computeIfAbsent(
                        normalizeKey(oreName),
                        key -> new UserOreAccumulator(oreName)
                );
                soldUserOreAccumulator.totalCscu += cscu;
                soldUserOreAccumulator.totalScu += scu;

                saleNames.add(oreName);

                OreAccumulator oreAccumulator = oreByName.computeIfAbsent(
                        normalizeKey(oreName),
                        key -> new OreAccumulator(oreName)
                );
                oreAccumulator.totalCscu += cscu;
                oreAccumulator.totalScu += scu;
            }
        }

        Map<String, UexResourceSaleDTO> saleByName = resolveSalesByOreName(saleNames, sheet.getSaleLocation());
        List<MiningSheetSummaryOreDTO> oreRows = new ArrayList<>();
        long totalEstimated = 0L;

        for (OreAccumulator accumulator : oreByName.values()) {
            UexResourceSaleDTO sale = saleByName.get(normalizeKey(accumulator.oreName));
            Integer bestSell = sale == null ? null : sale.getBestSell();
            Long estimated = (bestSell == null || bestSell <= 0)
                    ? null
                    : bestSell.longValue() * accumulator.totalScu;
            if (estimated != null) {
                totalEstimated += estimated;
            }

            oreRows.add(new MiningSheetSummaryOreDTO(
                    accumulator.oreName,
                    roundCscu(accumulator.totalCscu),
                    accumulator.totalScu,
                    bestSell,
                    sale == null ? null : sale.getBestSellTerminal(),
                    estimated
            ));
        }

        oreRows.sort((left, right) -> Long.compare(
                right.estimatedAuec() == null ? -1L : right.estimatedAuec(),
                left.estimatedAuec() == null ? -1L : left.estimatedAuec()
        ));

        List<MiningSheetSummaryOreDTO> keptOreRows = keptOreByName.values().stream()
                .sorted((left, right) -> Long.compare(right.totalScu, left.totalScu))
                .map(accumulator -> new MiningSheetSummaryOreDTO(
                        accumulator.oreName,
                        roundCscu(accumulator.totalCscu),
                        accumulator.totalScu,
                        null,
                        null,
                        null
                ))
                .toList();

        Map<UUID, Long> grossByUser = new LinkedHashMap<>();
        List<MiningSheetUserMaterialDTO> userMaterialRows = new ArrayList<>();
        for (UserMaterialAccumulator materialAccumulator : materialsByUser.values()) {
            List<MiningSheetUserMaterialOreDTO> userOres = materialAccumulator.oresByName.values().stream()
                    .sorted(Comparator.comparing((UserOreAccumulator item) -> item.totalScu).reversed())
                    .map(item -> new MiningSheetUserMaterialOreDTO(
                            item.oreName,
                            roundCscu(item.totalCscu),
                            item.totalScu
                    ))
                    .toList();

            long gross = 0L;
            for (UserOreAccumulator item : materialAccumulator.soldOresByName.values()) {
                UexResourceSaleDTO sale = saleByName.get(normalizeKey(item.oreName));
                Integer bestSell = sale == null ? null : sale.getBestSell();
                if (bestSell != null && bestSell > 0) {
                    gross += bestSell.longValue() * item.totalScu;
                }
            }
            grossByUser.put(materialAccumulator.user.getId(), gross);

            userMaterialRows.add(new MiningSheetUserMaterialDTO(
                    materialAccumulator.user.getId(),
                    materialAccumulator.user.getUsername(),
                    materialAccumulator.totalScu,
                    userOres
            ));
        }

        userMaterialRows.sort(Comparator.comparingLong(MiningSheetUserMaterialDTO::totalScu).reversed());

        List<User> settlementUsers = participantIds.stream()
                .map(participantUsers::get)
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(User::getUsername, String.CASE_INSENSITIVE_ORDER))
                .toList();

        List<MiningSheetSettlementDTO> settlements = buildSettlements(
                settlementUsers,
                grossByUser,
                paidCostsByUser,
                totalCosts,
                totalEstimated
        );

        long netEstimated = totalEstimated - totalCosts;

        return new MiningSheetSummaryDTO(
                oreRows,
                keptOreRows,
                Math.max(0L, longestRemainingSeconds),
                userMaterialRows,
                totalEstimated,
                totalCosts,
                netEstimated,
                settlements
        );
    }

    private List<MiningSheetSettlementDTO> buildSettlements(
            List<User> users,
            Map<UUID, Long> grossByUser,
            Map<UUID, Long> paidCostsByUser,
            long totalCosts,
            long totalEstimated
    ) {
        if (users.isEmpty()) {
            return List.of();
        }

        long baseShare = totalCosts / users.size();
        long remainder = totalCosts % users.size();
        long netEstimated = totalEstimated - totalCosts;
        long basePayout = netEstimated / users.size();
        long payoutRemainder = Math.abs(netEstimated % users.size());
        int payoutSign = netEstimated < 0 ? -1 : 1;

        List<MiningSheetSettlementDTO> rows = new ArrayList<>();
        for (int index = 0; index < users.size(); index++) {
            User user = users.get(index);
            long share = baseShare + (index < remainder ? 1L : 0L);
            long gross = grossByUser.getOrDefault(user.getId(), 0L);
            long paid = paidCostsByUser.getOrDefault(user.getId(), 0L);
            long compensation = paid - share;
            long payout = basePayout + (index < payoutRemainder ? payoutSign : 0L);

            rows.add(new MiningSheetSettlementDTO(
                    user.getId(),
                    user.getUsername(),
                    gross,
                    paid,
                    share,
                    compensation,
                    payout
            ));
        }
        return rows;
    }

    private Map<String, UexResourceSaleDTO> resolveSalesByOreName(Set<String> oreNames, String saleLocation) {
        if (oreNames.isEmpty()) {
            return Map.of();
        }

        ResponseEntity<MessageResponse<List<UexResourceSaleDTO>>> response = uexDatasetService.listResourceSales(new ArrayList<>(oreNames), saleLocation);
        List<UexResourceSaleDTO> rows = Optional.ofNullable(response.getBody())
                .map(MessageResponse::getData)
                .orElse(List.of());

        Map<String, UexResourceSaleDTO> byName = new LinkedHashMap<>();
        for (UexResourceSaleDTO row : rows) {
            if (row == null) {
                continue;
            }
            if (row.getDisplayName() != null && !row.getDisplayName().isBlank()) {
                byName.put(normalizeKey(row.getDisplayName()), row);
            }
            if (row.getCanonicalName() != null && !row.getCanonicalName().isBlank()) {
                byName.put(normalizeKey(row.getCanonicalName()), row);
            }
        }
        return byName;
    }

    private MiningSheetUserDTO toUserDto(User user) {
        if (user == null) {
            return new MiningSheetUserDTO(null, "-", List.of(), null);
        }
        List<String> roles = user.getRoles() == null
                ? List.of()
                : user.getRoles().stream()
                .map(UserRole::getRole)
                .filter(Objects::nonNull)
                .map(role -> role.getName())
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        return new MiningSheetUserDTO(
                user.getId(),
                user.getUsername(),
                roles,
                user.getAvatarUrl()
        );
    }

    private User findUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable."));
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizeNullableText(String value) {
        String normalized = normalizeText(value);
        return normalized.isBlank() ? null : normalized;
    }

    private String resolveSheetName(String rawName, LocalDateTime referenceDateTime) {
        String normalized = normalizeText(rawName);
        if (normalized.isBlank()) {
            LocalDateTime source = referenceDateTime == null ? LocalDateTime.now() : referenceDateTime;
            return "Fiche " + source.format(SHEET_NAME_TIME_FORMATTER);
        }
        if (normalized.length() > 180) {
            return normalized.substring(0, 180);
        }
        return normalized;
    }

    private String normalizeKey(String value) {
        return normalizeText(value)
                .toLowerCase(Locale.ROOT)
                .replace(" ", "");
    }

    private int safePositiveInt(Integer value) {
        if (value == null || value < 0) {
            return 0;
        }
        return value;
    }

    private double safePositiveDouble(Double value) {
        if (value == null || !Double.isFinite(value) || value < 0d) {
            return 0d;
        }
        return value;
    }

    private double safePositiveDouble(BigDecimal value) {
        if (value == null) {
            return 0d;
        }
        return Math.max(0d, value.doubleValue());
    }

    private double roundCscu(double value) {
        double safe = value;
        return Math.round(safe * 10000d) / 10000d;
    }

    private double roundCscu(BigDecimal value) {
        double safe = value == null ? 0d : value.doubleValue();
        return Math.round(safe * 10000d) / 10000d;
    }

    private long toScu(double cscu) {
        return Math.round(Math.max(0d, cscu) / 100d);
    }

    private long toScu(BigDecimal cscu) {
        return Math.round(safePositiveDouble(cscu) / 100d);
    }

    private static final class OreAccumulator {
        private final String oreName;
        private double totalCscu;
        private long totalScu;

        private OreAccumulator(String oreName) {
            this.oreName = oreName;
        }
    }

    private static final class UserOreAccumulator {
        private final String oreName;
        private double totalCscu;
        private long totalScu;

        private UserOreAccumulator(String oreName) {
            this.oreName = oreName;
        }
    }

    private static final class UserMaterialAccumulator {
        private final User user;
        private long totalScu;
        private final Map<String, UserOreAccumulator> oresByName = new LinkedHashMap<>();
        private final Map<String, UserOreAccumulator> soldOresByName = new LinkedHashMap<>();

        private UserMaterialAccumulator(User user) {
            this.user = user;
        }
    }
}
