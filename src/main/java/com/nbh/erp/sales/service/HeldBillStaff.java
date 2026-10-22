package com.nbh.erp.sales.service;

import com.nbh.erp.sales.dto.InvoiceDto;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.*;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class HeldBillStaff {
    private final UserRepository users;
    public void enrich(InvoiceDto bill) { enrich(List.of(bill)); }
    public void enrich(List<InvoiceDto> bills) {
        var usernames=bills.stream().filter(b->b.getCreatedByName()==null || b.getCreatedByEmployeeCode()==null)
            .map(InvoiceDto::getCreatedBy).filter(Objects::nonNull).distinct().toList();
        if(usernames.isEmpty())return;
        var identities=users.findByUsernameIn(usernames).stream().collect(Collectors.toMap(User::getUsername,u->u));
        for(var bill:bills){
            var user=identities.get(bill.getCreatedBy());if(user==null)continue;
            if(bill.getCreatedByName()==null)bill.setCreatedByName(user.getFullName()==null || user.getFullName().isBlank()?user.getUsername():user.getFullName());
            if(bill.getCreatedByEmployeeCode()==null)bill.setCreatedByEmployeeCode(user.getEmployeeCode());
        }
    }
}
