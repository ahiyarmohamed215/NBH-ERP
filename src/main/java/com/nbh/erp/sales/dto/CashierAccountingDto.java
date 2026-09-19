package com.nbh.erp.sales.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CashierAccountingDto {
    private String username;
    private String fullName;
    private String email;
    private List<String> roles;
    private Long completedInvoicesCount;
    private BigDecimal totalSalesAmount;
    private Long heldInvoicesCount;
    private BigDecimal totalHeldAmount;
    private LocalDate lastSaleDate;
}
