package com.nbh.erp.gtn.entity;

import com.nbh.erp.common.entity.BaseEntity;
import com.nbh.erp.warehouse.entity.Warehouse;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "gtns")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Gtn extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gtn_number", nullable = false, unique = true, length = 50)
    private String gtnNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_warehouse_id", nullable = false)
    private Warehouse sourceWarehouse;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "destination_warehouse_id", nullable = false)
    private Warehouse destinationWarehouse;

    @Column(nullable = false, length = 30)
    @Builder.Default
    private String status = "DRAFT"; // DRAFT, DISPATCHED, RECEIVED, CANCELLED

    @Column(name = "dispatch_date")
    private LocalDate dispatchDate;

    @Column(name = "receive_date")
    private LocalDate receiveDate;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @OneToMany(mappedBy = "gtn", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<GtnItem> items = new ArrayList<>();
}
