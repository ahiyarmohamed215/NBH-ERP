package com.nbh.erp.sales.dto;

import com.nbh.erp.common.exception.BusinessException;

public record InvoicePacking(Integer boxes, Integer bags, Integer pBags, Integer others) {
    public void validate() {
        for (Integer count : new Integer[]{boxes,bags,pBags,others})
            if (count == null || count < 0 || count > 1000000)
                throw new BusinessException("Enter Box, Bag, P. Bag and Others quantities as whole numbers from 0 to 1000000");
    }
}
