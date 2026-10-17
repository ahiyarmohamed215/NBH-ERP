package com.nbh.erp.sales.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record HeldBillWorkspaceDto(List<InvoiceDto> bills, LocalDate periodStart, LocalDate periodEnd,
        long mineCount, BigDecimal mineAmount, long othersCount, BigDecimal othersAmount,
        BigDecimal visibleAmount) {}
