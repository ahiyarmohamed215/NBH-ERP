package com.nbh.erp.sales.dto;

import com.nbh.erp.common.exception.BusinessException;

public record InvoicePacking(Integer boxes, Integer bags, Integer pBags, Integer others) {
    public static InvoicePacking from(com.nbh.erp.sales.entity.Invoice bill){
        return new InvoicePacking(zero(bill.getPackingBoxes()),zero(bill.getPackingBags()),zero(bill.getPackingPBags()),zero(bill.getPackingOthers()));
    }
    private static int zero(Integer value){return value==null?0:value;}
    public static InvoicePacking sum(java.util.Collection<InvoicePacking> values){
        int boxes=0,bags=0,pBags=0,others=0;
        for(var value:values){boxes=Math.addExact(boxes,zero(value.boxes()));bags=Math.addExact(bags,zero(value.bags()));pBags=Math.addExact(pBags,zero(value.pBags()));others=Math.addExact(others,zero(value.others()));}
        return new InvoicePacking(boxes,bags,pBags,others);
    }
    public void applyTo(com.nbh.erp.sales.entity.Invoice bill){
        bill.setPackingBoxes(boxes);bill.setPackingBags(bags);bill.setPackingPBags(pBags);bill.setPackingOthers(others);
    }
    public void validate() {
        for (Integer count : new Integer[]{boxes,bags,pBags,others})
            if (count == null || count < 0 || count > 1000000)
                throw new BusinessException("Enter Box, Bag, P. Bag and Others quantities as whole numbers from 0 to 1000000");
    }
}
