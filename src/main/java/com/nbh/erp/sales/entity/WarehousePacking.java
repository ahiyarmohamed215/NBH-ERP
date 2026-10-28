package com.nbh.erp.sales.entity;

import com.nbh.erp.sales.dto.InvoicePacking;
import jakarta.persistence.*;
import lombok.*;

@Embeddable @Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class WarehousePacking {
    @Column(nullable=false) private Integer boxes;
    @Column(nullable=false) private Integer bags;
    @Column(name="p_bags",nullable=false) private Integer pBags;
    @Column(nullable=false) private Integer others;

    public InvoicePacking toDto(){return new InvoicePacking(boxes,bags,pBags,others);}
    public static WarehousePacking from(InvoicePacking value){return new WarehousePacking(value.boxes(),value.bags(),value.pBags(),value.others());}
}
