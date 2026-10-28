package com.nbh.erp.delivery.service;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.common.exception.DuplicateResourceException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.delivery.dto.CreateDeliveryRouteRequest;
import com.nbh.erp.delivery.dto.DeliveryRouteDto;
import com.nbh.erp.delivery.entity.DeliveryRoute;
import com.nbh.erp.delivery.repository.DeliveryRouteRepository;
import com.nbh.erp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeliveryRouteService {

    private final DeliveryRouteRepository routeRepository;
    private final CustomerRepository customerRepository;
    private final com.nbh.erp.user.repository.UserRepository userRepository;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<DeliveryRouteDto> getAllRoutes() {
        return routeRepository.findAll().stream()
                .filter(r -> r.getDeletedAt() == null)
                .sorted(java.util.Comparator.comparing(
                        (DeliveryRoute r) -> r.getUpdatedAt() != null ? r.getUpdatedAt() : r.getCreatedAt(),
                        java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())
                ).thenComparing(DeliveryRoute::getId, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())))
                .map(route -> {
                    List<Long> custIds = customerRepository.findByDeliveryRouteId(route.getId()).stream()
                            .map(Customer::getId)
                            .toList();
                    return DeliveryRouteDto.from(route, custIds);
                }).toList();
    }

    @Transactional(readOnly = true)
    public List<DeliveryRouteDto> getActiveRoutes() {
        return routeRepository.findByIsActiveTrue().stream()
                .filter(r -> r.getDeletedAt() == null)
                .sorted(java.util.Comparator.comparing(
                        (DeliveryRoute r) -> r.getUpdatedAt() != null ? r.getUpdatedAt() : r.getCreatedAt(),
                        java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())
                ).thenComparing(DeliveryRoute::getId, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())))
                .map(route -> {
                    List<Long> custIds = customerRepository.findByDeliveryRouteId(route.getId()).stream()
                            .map(Customer::getId)
                            .toList();
                    return DeliveryRouteDto.from(route, custIds);
                }).toList();
    }

    @Transactional(readOnly = true)
    public DeliveryRouteDto getRouteById(Long id) {
        DeliveryRoute route = routeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("DeliveryRoute", "id", id));
        route.requireNotDeleted();
        List<Long> custIds = customerRepository.findByDeliveryRouteId(route.getId()).stream()
                .map(Customer::getId)
                .toList();
        return DeliveryRouteDto.from(route, custIds);
    }

    private void validateRouteInput(CreateDeliveryRouteRequest req, boolean draft) {
        if (!draft && !StringUtils.hasText(req.getRouteName())) {
            throw new com.nbh.erp.common.exception.BusinessException("Route name is required before activation");
        }
        if (draft) {
            boolean hasAny = StringUtils.hasText(req.getRouteName())
                    || StringUtils.hasText(req.getRouteCode())
                    || StringUtils.hasText(req.getDescription())
                    || StringUtils.hasText(req.getArea())
                    || req.getEffectiveStaffId() != null
                    || StringUtils.hasText(req.getStartLocation())
                    || StringUtils.hasText(req.getEndLocation())
                    || req.getEstimatedDurationMinutes() != null
                    || req.getEstimatedDistanceKm() != null
                    || (req.getCustomerIds() != null && !req.getCustomerIds().isEmpty());
            if (!hasAny) {
                throw new com.nbh.erp.common.exception.BusinessException("Fill at least one input before saving a route draft");
            }
        }
    }

    @Transactional
    public DeliveryRouteDto createRoute(CreateDeliveryRouteRequest req) {
        boolean isDraft = req.isDraft();
        validateRouteInput(req, isDraft);

        String code = req.getRouteCode();
        if (!StringUtils.hasText(code)) {
            code = "DR-" + String.format("%03d", routeRepository.count() + 1);
        } else {
            code = code.trim().toUpperCase();
        }

        if (routeRepository.existsByRouteCode(code)) {
            throw new DuplicateResourceException("DeliveryRoute", "routeCode", code);
        }

        com.nbh.erp.user.entity.User assignedStaff = null;
        Long staffId = req.getEffectiveStaffId();
        if (staffId != null) {
            assignedStaff = userRepository.findById(staffId).orElse(null);
        }

        String routeName = StringUtils.hasText(req.getRouteName())
                ? req.getRouteName().trim()
                : (isDraft ? "Draft Route " + code : code);

        String status = isDraft ? "DRAFT" : (Boolean.FALSE.equals(req.getIsActive()) ? "INACTIVE" : "ACTIVE");

        DeliveryRoute route = DeliveryRoute.builder()
                .routeCode(code)
                .routeName(routeName)
                .description(req.getDescription())
                .area(req.getArea())
                .assignedStaff(assignedStaff)
                .startLocation(req.getStartLocation())
                .endLocation(req.getEndLocation())
                .estimatedDurationMinutes(req.getEstimatedDurationMinutes())
                .estimatedDistanceKm(req.getEstimatedDistanceKm())
                .deliveryDays(req.getDeliveryDays())
                .status(status)
                .isActive(!isDraft && (req.getIsActive() == null || req.getIsActive()))
                .build();

        DeliveryRoute saved = routeRepository.save(route);

        if (req.getCustomerIds() != null && !req.getCustomerIds().isEmpty()) {
            customerRepository.requireActiveCustomers(req.getCustomerIds()).forEach(c -> c.setDeliveryRoute(saved));
        }

        auditLogService.log(
                "DELIVERY_ROUTE_CREATE",
                "DeliveryRoute",
                saved.getRouteCode(),
                String.format("Delivery route '%s' created with code '%s'", saved.getRouteName(), saved.getRouteCode())
        );

        List<Long> custIds = customerRepository.findByDeliveryRouteId(saved.getId()).stream()
                .map(Customer::getId)
                .toList();
        return DeliveryRouteDto.from(saved, custIds);
    }

    @Transactional
    public DeliveryRouteDto updateRoute(Long id, CreateDeliveryRouteRequest req) {
        DeliveryRoute route = routeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("DeliveryRoute", "id", id));

        SecurityUtils.enforceCanEdit("DELIVERY", "Delivery Route: " + route.getRouteName());
        route.requireNotDeleted();

        boolean isDraft = req.isDraft();
        validateRouteInput(req, isDraft);

        String code = req.getRouteCode();
        if (StringUtils.hasText(code)) {
            String newCode = code.trim().toUpperCase();
            if (!newCode.equals(route.getRouteCode()) && routeRepository.existsByRouteCode(newCode)) {
                throw new DuplicateResourceException("DeliveryRoute", "routeCode", newCode);
            }
            route.setRouteCode(newCode);
        }

        Long staffId = req.getEffectiveStaffId();
        if (staffId != null) {
            route.setAssignedStaff(userRepository.findById(staffId).orElse(null));
        } else {
            route.setAssignedStaff(null);
        }

        if (isDraft) {
            if (StringUtils.hasText(req.getRouteName())) {
                route.setRouteName(req.getRouteName().trim());
            } else if (!StringUtils.hasText(route.getRouteName())) {
                route.setRouteName("Draft Route " + route.getRouteCode());
            }
            route.setStatus("DRAFT");
            route.setIsActive(false);
        } else {
            route.setRouteName(req.getRouteName().trim());
            if ("DRAFT".equals(route.getStatus())) {
                route.setStatus(Boolean.FALSE.equals(req.getIsActive()) ? "INACTIVE" : "ACTIVE");
                route.setIsActive(req.getIsActive() == null || req.getIsActive());
            } else if (req.getIsActive() != null) {
                route.setIsActive(req.getIsActive());
                route.setStatus(req.getIsActive() ? "ACTIVE" : "INACTIVE");
            }
        }

        route.setDescription(req.getDescription());
        route.setArea(req.getArea());
        route.setStartLocation(req.getStartLocation());
        route.setEndLocation(req.getEndLocation());
        route.setEstimatedDurationMinutes(req.getEstimatedDurationMinutes());
        route.setEstimatedDistanceKm(req.getEstimatedDistanceKm());
        route.setDeliveryDays(req.getDeliveryDays());

        DeliveryRoute saved = routeRepository.save(route);

        if (req.getCustomerIds() != null) {
            customerRepository.findByDeliveryRouteId(saved.getId()).forEach(c -> {
                if (!req.getCustomerIds().contains(c.getId())) {
                    c.setDeliveryRoute(null);
                }
            });
            customerRepository.requireActiveCustomers(req.getCustomerIds()).forEach(c -> c.setDeliveryRoute(saved));
        }

        auditLogService.log(
                "DELIVERY_ROUTE_UPDATE",
                "DeliveryRoute",
                saved.getRouteCode(),
                String.format("Delivery route '%s' updated", saved.getRouteName())
        );

        List<Long> custIds = customerRepository.findByDeliveryRouteId(saved.getId()).stream()
                .map(Customer::getId)
                .toList();
        return DeliveryRouteDto.from(saved, custIds);
    }

    @Transactional
    public void deleteRoute(Long id) {
        SecurityUtils.enforceNoDelete("DeliveryRoute", id);
    }

    @Transactional
    public DeliveryRouteDto toggleActive(Long id) {
        DeliveryRoute route = routeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("DeliveryRoute", "id", id));
        SecurityUtils.enforceCanEdit("DELIVERY", "Delivery Route: " + route.getRouteName());
        route.requireNotDeleted();
        boolean nextActive = !Boolean.TRUE.equals(route.getIsActive());
        route.setIsActive(nextActive);
        route.setStatus(nextActive ? "ACTIVE" : "INACTIVE");
        DeliveryRoute saved = routeRepository.save(route);
        auditLogService.log("DELIVERY_ROUTE_STATUS", "DeliveryRoute", saved.getRouteCode(),
                "Delivery route status changed to " + (saved.getIsActive() ? "Active" : "Inactive"));
        List<Long> customerIds = customerRepository.findByDeliveryRouteId(id).stream().map(Customer::getId).toList();
        return DeliveryRouteDto.from(saved, customerIds);
    }

    @Transactional
    public DeliveryRouteDto changeStatus(Long id, String status, String reason) {
        reason = com.nbh.erp.common.dto.StatusChangeRequest.requireReason(reason);
        if (!java.util.Set.of("ACTIVE", "INACTIVE", "DRAFT").contains(status)) throw new com.nbh.erp.common.exception.BusinessException("Choose Active or Inactive");
        DeliveryRoute route = routeRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("DeliveryRoute", "id", id));
        SecurityUtils.enforceCanEdit("DELIVERY", "Delivery Route: " + route.getRouteName());
        route.requireNotDeleted();
        route.setStatus(status);
        route.setIsActive("ACTIVE".equals(status));
        routeRepository.save(route);
        auditLogService.log("DELIVERY_ROUTE_STATUS", "DeliveryRoute", route.getRouteCode(), "Status changed to " + status + ". Reason: " + reason);
        return getRouteById(id);
    }

    @Transactional
    public void seedDefaultRoutesIfEmpty() {
        if (routeRepository.count() == 0) {
            DeliveryRoute r1 = routeRepository.save(DeliveryRoute.builder()
                    .routeCode("DR-001")
                    .routeName("Colombo Western Corridor")
                    .description("Daily retail and supermarket delivery route across Colombo & suburbs")
                    .area("Western Province")
                    .startLocation("Central Distribution Warehouse")
                    .endLocation("Colombo City Hub")
                    .estimatedDurationMinutes(180)
                    .estimatedDistanceKm(45.0)
                    .deliveryDays("Monday, Wednesday, Friday")
                    .isActive(true)
                    .build());

            DeliveryRoute r2 = routeRepository.save(DeliveryRoute.builder()
                    .routeCode("DR-002")
                    .routeName("Southern Coastal Highway")
                    .description("Wholesale and hardware store delivery route Galle - Matara - Weligama")
                    .area("Southern Province")
                    .startLocation("Central Distribution Warehouse")
                    .endLocation("Matara Town Terminal")
                    .estimatedDurationMinutes(240)
                    .estimatedDistanceKm(120.0)
                    .deliveryDays("Tuesday, Thursday, Saturday")
                    .isActive(true)
                    .build());

            log.info("Initialized default delivery routes: {}, {}", r1.getRouteCode(), r2.getRouteCode());
        }
    }
}
