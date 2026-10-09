package com.nbh.erp.customerrange.entity;

import com.nbh.erp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "customer_range_configs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomerRangeConfig extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "range_code", nullable = false, unique = true, length = 30)
    private String rangeCode; // e.g. RANGE_0, RANGE_1

    @Column(nullable = false, length = 100)
    private String name; // e.g. Range 0, Range 1, Range 2, VIP

    @Column(name = "min_spend", nullable = false, precision = 38, scale = 2, unique = true)
    private BigDecimal minSpend; // e.g. 0.00, 50000.00, 150000.00

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(length = 255)
    private String description;
}
