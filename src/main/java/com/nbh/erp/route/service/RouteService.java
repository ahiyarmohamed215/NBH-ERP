package com.nbh.erp.route.service;

import com.nbh.erp.audit.service.AuditLogService;
import com.nbh.erp.common.exception.DuplicateResourceException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.route.dto.CreateRouteRequest;
import com.nbh.erp.route.dto.RouteDto;
import com.nbh.erp.route.entity.Route;
import com.nbh.erp.route.repository.RouteRepository;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RouteService {

    private final RouteRepository routeRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<RouteDto> getAllRoutes() {
        return routeRepository.findAll().stream().map(RouteDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<RouteDto> getActiveRoutes() {
        return routeRepository.findByIsActiveTrue().stream().map(RouteDto::from).toList();
    }

    @Transactional(readOnly = true)
    public RouteDto getRouteById(Long id) {
        Route route = routeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Route", "id", id));
        return RouteDto.from(route);
    }

    @Transactional
    public RouteDto createRoute(CreateRouteRequest request) {
        String code = request.getRouteCode();
        if (!StringUtils.hasText(code)) {
            code = "RT-" + String.format("%03d", routeRepository.count() + 1);
        } else {
            code = code.trim().toUpperCase();
        }

        if (routeRepository.existsByRouteCode(code)) {
            throw new DuplicateResourceException("Route", "code", code);
        }

        User salesRep = null;
        if (request.getSalesRepId() != null) {
            salesRep = userRepository.findById(request.getSalesRepId()).orElse(null);
        }

        Route route = Route.builder()
                .routeCode(code)
                .routeName(request.getRouteName().trim())
                .area(request.getArea())
                .description(request.getDescription())
                .salesRep(salesRep)
                .deliveryDays(request.getDeliveryDays())
                .isActive(true)
                .build();

        Route saved = routeRepository.save(route);

        auditLogService.log(
                "ROUTE_CREATE",
                "Route",
                saved.getRouteCode(),
                String.format("Delivery route '%s' created with code '%s'", saved.getRouteName(), saved.getRouteCode())
        );

        return RouteDto.from(saved);
    }

    @Transactional
    public RouteDto updateRoute(Long id, CreateRouteRequest request) {
        Route route = routeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Route", "id", id));

        if (StringUtils.hasText(request.getRouteCode())) {
            String newCode = request.getRouteCode().trim().toUpperCase();
            if (!newCode.equals(route.getRouteCode()) && routeRepository.existsByRouteCode(newCode)) {
                throw new DuplicateResourceException("Route", "code", newCode);
            }
            route.setRouteCode(newCode);
        }

        if (StringUtils.hasText(request.getRouteName())) {
            route.setRouteName(request.getRouteName().trim());
        }

        route.setArea(request.getArea());
        route.setDescription(request.getDescription());
        route.setDeliveryDays(request.getDeliveryDays());

        if (request.getSalesRepId() != null) {
            User salesRep = userRepository.findById(request.getSalesRepId()).orElse(null);
            route.setSalesRep(salesRep);
        } else {
            route.setSalesRep(null);
        }

        Route saved = routeRepository.save(route);

        auditLogService.log(
                "ROUTE_UPDATE",
                "Route",
                saved.getRouteCode(),
                String.format("Delivery route '%s' updated", saved.getRouteName())
        );

        return RouteDto.from(saved);
    }

    @Transactional
    public void toggleActive(Long id) {
        Route route = routeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Route", "id", id));
        route.setIsActive(!Boolean.TRUE.equals(route.getIsActive()));
        routeRepository.save(route);

        auditLogService.log(
                "ROUTE_TOGGLE_ACTIVE",
                "Route",
                route.getRouteCode(),
                String.format("Route '%s' active status changed to %s", route.getRouteName(), route.getIsActive())
        );
    }

    @Transactional
    public void deleteRoute(Long id) {
        Route route = routeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Route", "id", id));
        route.setIsActive(false);
        routeRepository.save(route);

        auditLogService.log(
                "ROUTE_DELETE",
                "Route",
                route.getRouteCode(),
                String.format("Route '%s' soft-deleted", route.getRouteName())
        );
    }
}
