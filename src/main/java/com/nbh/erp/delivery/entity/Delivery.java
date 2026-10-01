package com.nbh.erp.delivery.entity;

import com.nbh.erp.common.entity.BaseEntity;
import com.nbh.erp.sales.entity.Invoice;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.warehouse.entity.Warehouse;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "deliveries", indexes = {
        @Index(name = "idx_del_number", columnList = "delivery_number"),
        @Index(name = "idx_del_status", columnList = "status"),
        @Index(name = "idx_del_date", columnList = "scheduled_date")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Delivery extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "delivery_number", nullable = false, unique = true, length = 50)
    private String deliveryNumber; // e.g. DEL-20261001-001

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "warehouse_id")
    private Warehouse warehouse;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "route_id")
    private DeliveryRoute route;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicle_id")
    private Vehicle vehicle;

    @Column(name = "vehicle_number", length = 50)
    private String vehicleNumber;

    // Two Assigned Staff Members
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "driver_id", nullable = false)
    private User driver; // Staff 1: Driver / Lead Dispatcher

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assistant_staff_id", nullable = false)
    private User assistantStaff; // Staff 2: Delivery Assistant / Helper

    // Journey Timings
    @Column(name = "scheduled_date", nullable = false)
    private LocalDate scheduledDate;

    @Column(name = "departure_time")
    private LocalDateTime departureTime; // When it goes

    @Column(name = "return_time")
    private LocalDateTime returnTime; // When it returns

    @Column(name = "trip_duration_minutes")
    private Integer tripDurationMinutes; // Computed duration in minutes

    // Lifecycle: SCHEDULED, IN_TRANSIT, DELIVERED, CANCELLED
    @Column(nullable = false, length = 30)
    @Builder.Default
    private String status = "SCHEDULED";

    @Column(name = "total_invoices_count")
    @Builder.Default
    private Integer totalInvoicesCount = 0;

    @Column(name = "total_amount", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "start_odometer")
    private Double startOdometer;

    @Column(name = "end_odometer")
    private Double endOdometer;

    @Column(name = "gps_tracking_code", length = 100)
    private String gpsTrackingCode;

    @Column(name = "gps_last_location", length = 255)
    private String gpsLastLocation;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "cancellation_reason", columnDefinition = "TEXT")
    private String cancellationReason;

    @Column(name = "cancellation_date")
    private LocalDateTime cancellationDate;

    @OneToMany(mappedBy = "delivery")
    @Builder.Default
    private List<Invoice> invoices = new ArrayList<>();
}
