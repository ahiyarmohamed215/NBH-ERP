package com.nbh.erp.customer.service;

import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.customer.dto.CustomerDto;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.security.SecurityUtils;
import com.nbh.erp.security.UserPrincipal;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service @RequiredArgsConstructor
public class PosCustomerAccess {
    private final CustomerRepository customers;
    private final UserRepository users;
    public static boolean canUsePos(User user){
        return user!=null && Boolean.TRUE.equals(user.getIsActive()) && "APPROVED".equalsIgnoreCase(user.getApprovalStatus())
            && UserPrincipal.create(user).getAuthorities().stream().anyMatch(a->Set.of("SALES_CREATE","ROLE_ADMIN","ROLE_SUPER_ADMIN").contains(a.getAuthority()));
    }
    private User currentStaff(){
        var user=users.findByUsername(SecurityUtils.getCurrentUsername().orElseThrow(()->new BusinessException("Sign in to use POS"))).orElseThrow(()->new BusinessException("POS staff account not found"));
        if(!canUsePos(user))throw new BusinessException("This staff member does not have active POS access");
        return user;
    }
    @Transactional(readOnly=true)
    public List<CustomerDto> customers(){
        return customers(null);
    }
    @Transactional(readOnly=true)
    public List<CustomerDto> customers(Long deliveryRouteId){
        var staff=currentStaff();
        List<Customer> list = (deliveryRouteId == null)
            ? customers.findAssignedPosCustomers(staff.getId())
            : customers.findAssignedPosCustomersByRoute(staff.getId(), deliveryRouteId);
        return list.stream().map(CustomerDto::from).toList();
    }
    @Transactional(readOnly=true)
    public void requireAssigned(Long customerId){
        requireAssigned(customerId, null);
    }
    @Transactional(readOnly=true)
    public void requireAssigned(Long customerId, Long deliveryRouteId){
        var staff=currentStaff();
        if(customerId==null || !customers.isAssignedPosCustomer(customerId,staff.getId()))
            throw new BusinessException("This customer is not assigned to you in an active customer group. Select one of your assigned POS customers.");
        if(deliveryRouteId!=null && !customers.isAssignedPosCustomerForRoute(customerId, staff.getId(), deliveryRouteId))
            throw new BusinessException("This customer is not assigned to you on the selected delivery route.");
    }
}
