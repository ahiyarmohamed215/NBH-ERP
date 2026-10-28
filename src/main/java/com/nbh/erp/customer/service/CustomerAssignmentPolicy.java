package com.nbh.erp.customer.service;

import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.customergroup.entity.CustomerGroup;
import com.nbh.erp.customergroup.repository.CustomerGroupRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.*;

/** Membership writers lock groups before customers; shared customers serialize competing assignments. */
@Service @RequiredArgsConstructor
public class CustomerAssignmentPolicy {
    private final CustomerRepository customers;
    private final CustomerGroupRepository groups;
    @jakarta.persistence.PersistenceContext private jakarta.persistence.EntityManager entityManager;

    public List<CustomerGroup> customerGroups(List<Long> ids){
        if(ids==null)return List.of();
        var selected=ids.stream().distinct().sorted().map(id->groups.findByIdForUpdate(id)
            .orElseThrow(()->new BusinessException("Unknown customer group"))).toList();
        if(selected.stream().filter(g->g.getAssignedStaff()!=null).map(g->g.getAssignedStaff().getId()).distinct().count()>1)
            throw new BusinessException("A customer can belong to only one staff member. Select groups assigned to the same staff member.");
        return selected;
    }

    public List<Customer> lockCustomers(Collection<Long> ids){
        return ids.stream().distinct().sorted().map(id->{
            var customer=customers.findAnyByIdForUpdate(id).orElseThrow(()->new BusinessException("Unknown customer in assignment"));
            entityManager.refresh(customer);
            return customer;
        }).toList();
    }

    public void validateGroup(Long groupId,Long staffId,List<Customer> members){
        if(staffId==null)return;
        for(var customer:members){
            var assigned=new HashSet<>(customers.findMappedStaffIds(customer.getId(),groupId));
            assigned.addAll(customers.findPrimaryStaffIds(customer.getId(),groupId));
            if(assigned.stream().anyMatch(id->!id.equals(staffId)))
                throw new BusinessException("Customer "+customer.getName()+" ("+customer.getCustomerCode()+") already belongs to another staff member. Remove the existing staff assignment before reassigning.");
        }
    }
}
