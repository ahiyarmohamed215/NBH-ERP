package com.nbh.erp;

import com.nbh.erp.customer.service.PosCustomerAccess;
import com.nbh.erp.customer.repository.CustomerRepository;
import com.nbh.erp.customer.entity.Customer;
import com.nbh.erp.customergroup.entity.CustomerGroup;
import com.nbh.erp.customergroup.repository.CustomerGroupRepository;
import com.nbh.erp.customergroup.service.CustomerGroupService;
import com.nbh.erp.customergroup.dto.CreateCustomerGroupRequest;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import com.nbh.erp.user.service.UserService;
import com.nbh.erp.role.entity.Role;
import com.nbh.erp.role.entity.Permission;
import com.nbh.erp.role.repository.RoleRepository;
import com.nbh.erp.role.repository.PermissionRepository;
import com.nbh.erp.sales.service.InvoiceService;
import com.nbh.erp.sales.service.HeldWarehouseWorkflow;
import com.nbh.erp.sales.dto.CreateInvoiceRequest;
import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.security.UserPrincipal;
import com.nbh.erp.common.exception.BusinessException;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.*;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest @Transactional
class PosCustomerAssignmentIntegrationTest {
 @Autowired PosCustomerAccess access;
 @Autowired CustomerRepository customers;
 @Autowired CustomerGroupRepository groups;
 @Autowired CustomerGroupService groupService;
 @Autowired UserRepository users;
 @Autowired UserService userService;
 @Autowired RoleRepository roles;
 @Autowired PermissionRepository permissions;
 @Autowired InvoiceService invoices;
 @Autowired InvoiceRepository records;
 @Autowired HeldWarehouseWorkflow workflow;
 @Autowired com.nbh.erp.inventory.service.StockService stock;
 @Autowired com.nbh.erp.warehouse.repository.WarehouseRepository warehouses;
 @Autowired com.nbh.erp.product.repository.ProductRepository products;
 @Autowired com.nbh.erp.category.repository.CategoryRepository categories;
 String key(){return UUID.randomUUID().toString().substring(0,8);}
 User staff(boolean pos){
  String key=key();var permission=permissions.findByName(pos?"SALES_CREATE":"CUSTOMER_VIEW").orElseGet(()->permissions.save(Permission.builder().name(pos?"SALES_CREATE":"CUSTOMER_VIEW").module(pos?"SALES":"CUSTOMER").build()));
  var role=roles.save(Role.builder().name("ROLE_ASSIGN_"+key).permissions(new HashSet<>(Set.of(permission))).build());
  return users.saveAndFlush(User.builder().username("assign-"+key).fullName("POS staff "+key).password("test").email(key+"@test.example").approvalStatus("APPROVED").isActive(true).roles(new HashSet<>(Set.of(role))).build());
 }
 void login(User staff){var p=UserPrincipal.create(staff);SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(p,null,p.getAuthorities()));}
 @AfterEach void clear(){SecurityContextHolder.clearContext();}
 CustomerGroup group(User staff,boolean active){String key=key();return groups.saveAndFlush(CustomerGroup.builder().groupCode(key).groupName("Group "+key).assignedStaff(staff).isActive(active).build());}
 Customer customer(CustomerGroup primary,CustomerGroup... assigned){
  String key=key();return customers.saveAndFlush(Customer.builder().customerCode(key).name("Customer "+key).creditLimit(BigDecimal.ZERO).currentBalance(BigDecimal.ZERO).isActive(true).customerGroup(primary).customerGroups(new HashSet<>(Arrays.asList(assigned))).build());
 }
 @Test void customerLookupIncludesOnlyActiveAssignmentsAcrossAllGroupsAndLegacyPrimary(){
  var a=staff(true);var b=staff(true);var ga=group(a,true);var ga2=group(a,true);var gb=group(b,true);var inactive=group(a,false);
  var own=customer(null,ga,ga2);var shared=customer(null,ga,gb);var legacy=customer(ga);var other=customer(null,gb);var unassigned=customer(null);var dormant=customer(null,inactive);var disabled=customer(null,ga);disabled.setIsActive(false);customers.saveAndFlush(disabled);
  login(a);var ids=access.customers().stream().map(c->c.getId()).toList();assertEquals(Set.of(own.getId(),shared.getId(),legacy.getId()),new HashSet<>(ids));assertEquals(3,ids.size());
  assertThrows(BusinessException.class,()->access.requireAssigned(other.getId()));assertThrows(BusinessException.class,()->access.requireAssigned(unassigned.getId()));assertThrows(BusinessException.class,()->access.requireAssigned(dormant.getId()));assertThrows(BusinessException.class,()->access.requireAssigned(disabled.getId()));
  ga.setAssignedStaff(b);ga2.setAssignedStaff(b);groups.saveAndFlush(ga);groups.saveAndFlush(ga2);assertTrue(access.customers().isEmpty());assertThrows(BusinessException.class,()->access.requireAssigned(own.getId()));
 }
 @Test void staffLookupAndGroupAssignmentRequireApprovedActivePosAccess(){
  var valid=staff(true);var noPos=staff(false);var inactive=staff(true);inactive.setIsActive(false);users.saveAndFlush(inactive);var pending=staff(true);pending.setApprovalStatus("PENDING");users.saveAndFlush(pending);
  var eligible=userService.getPosStaff().stream().map(u->u.getId()).toList();assertTrue(eligible.contains(valid.getId()));assertFalse(eligible.contains(noPos.getId()));assertFalse(eligible.contains(inactive.getId()));assertFalse(eligible.contains(pending.getId()));
  login(valid);for(var bad:List.of(noPos,inactive,pending))assertThrows(BusinessException.class,()->groupService.createGroup(CreateCustomerGroupRequest.builder().groupCode(key()).groupName("Invalid").assignedStaffId(bad.getId()).build()));
  var saved=groupService.createGroup(CreateCustomerGroupRequest.builder().groupCode(key()).groupName("Valid group").assignedStaffId(valid.getId()).build());assertEquals(valid.getId(),saved.getAssignedStaffId());
  valid.getRoles().clear();users.saveAndFlush(valid);assertThrows(BusinessException.class,()->access.customers());
 }
 @Test void billingAndDraftSubmissionRejectUnassignedOrReassignedCustomers(){
  var staff=staff(true);login(staff);var assigned=group(staff,true);var own=customer(null,assigned);var other=customer(null);
  String key=key();var warehouse=warehouses.save(com.nbh.erp.warehouse.entity.Warehouse.builder().code(key).name(key).isActive(true).build());var category=categories.save(com.nbh.erp.category.entity.Category.builder().code(key).name(key).build());
  var product=products.save(com.nbh.erp.product.entity.Product.builder().sku(key).name(key).category(category).defaultWarehouse(warehouse).sellingPrice(BigDecimal.TEN).costPrice(BigDecimal.ONE).isActive(true).build());
  stock.increaseStock(warehouse.getId(),product.getId(),BigDecimal.TEN,BigDecimal.ONE,"GRN",key,"Assignment test");
  var request=CreateInvoiceRequest.builder().customerId(other.getId()).warehouseId(warehouse.getId()).hold(true).reserveStock(true).items(List.of(CreateInvoiceRequest.CreateInvoiceItemRequest.builder().productId(product.getId()).quantity(BigDecimal.valueOf(2)).unitPrice(BigDecimal.TEN).build())).build();
  long count=records.count();assertThrows(BusinessException.class,()->invoices.createInvoice(request));assertEquals(count,records.count());assertEquals(0,BigDecimal.TEN.compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  request.setHold(false);assertThrows(BusinessException.class,()->invoices.createInvoice(request));request.setHold(true);request.setCustomerId(own.getId());var draft=invoices.createInvoice(request);assertEquals(0,BigDecimal.valueOf(8).compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
  request.setCustomerId(other.getId());request.setExpectedVersion(draft.getRecordVersion());assertThrows(BusinessException.class,()->invoices.savePosDraft(draft.getId(),request));
  assigned.setIsActive(false);groups.saveAndFlush(assigned);request.setCustomerId(own.getId());assertThrows(BusinessException.class,()->invoices.createInvoice(request));assertThrows(BusinessException.class,()->workflow.send(draft.getId(),new HeldWarehouseWorkflow.SendRequest(draft.getRecordVersion(),null,false)));
  assertEquals("HELD",records.findById(draft.getId()).orElseThrow().getStatus());assertNull(records.findById(draft.getId()).orElseThrow().getOriginalHeldSnapshot());assertEquals(0,BigDecimal.valueOf(8).compareTo(stock.getAvailableStock(warehouse.getId(),product.getId())));
 }
 @Test void administratorStillNeedsAnAssignedCustomerGroupForPos(){
  var admin=staff(true);admin.setRoles(new HashSet<>(Set.of(roles.findByName("ROLE_ADMIN").orElseThrow())));users.saveAndFlush(admin);login(admin);var customer=customer(null);
  assertTrue(access.customers().isEmpty());assertThrows(BusinessException.class,()->access.requireAssigned(customer.getId()));
 }
}
