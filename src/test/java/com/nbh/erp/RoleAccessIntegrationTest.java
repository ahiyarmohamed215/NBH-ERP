package com.nbh.erp;

import com.nbh.erp.role.entity.Role;
import com.nbh.erp.role.repository.RoleRepository;
import com.nbh.erp.role.repository.PermissionRepository;
import com.nbh.erp.role.service.RoleService;
import com.nbh.erp.role.dto.UpdateRoleRequest;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import com.nbh.erp.user.service.UserService;
import com.nbh.erp.user.dto.UpdateUserRequest;
import com.nbh.erp.security.UserPrincipal;
import com.nbh.erp.security.jwt.JwtTokenProvider;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @Transactional
class RoleAccessIntegrationTest {
 @Autowired WebApplicationContext context; @Autowired UserRepository users;
 @Autowired RoleRepository roles; @Autowired PermissionRepository permissions;
 @Autowired UserService userService; @Autowired RoleService roleService; @Autowired JwtTokenProvider tokens;
 MockMvc mvc;
 @BeforeEach void setup(){mvc=MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();}
 @AfterEach void clear(){SecurityContextHolder.clearContext();}
 User staff(String permission){
  String key=UUID.randomUUID().toString();
  Role role=roles.save(Role.builder().name("ROLE_TEST_"+key).description("Limited test role")
   .permissions(new HashSet<>(List.of(permissions.findByName(permission).orElseThrow()))).build());
  return users.save(User.builder().username("staff-"+key).email(key+"@example.test").fullName("Test staff")
   .password("unused-in-token-test").isActive(true).approvalStatus("APPROVED").roles(new HashSet<>(List.of(role))).build());
 }
 String token(User user){var principal=UserPrincipal.create(user);return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal,null,principal.getAuthorities()));}
 void asAdmin(){User admin=User.builder().id(9999L).username("test-administrator").roles(new HashSet<>(List.of(roles.findByName("ROLE_ADMIN").orElseThrow()))).isActive(true).approvalStatus("APPROVED").build();var p=UserPrincipal.create(admin);SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(p,null,p.getAuthorities()));}

 @Test void assignedViewPermissionsReachEveryModuleAndDoNotGrantWrites() throws Exception {
  String[][] cases={{"DASHBOARD_VIEW","/dashboard/summary"},{"CUSTOMER_VIEW","/customers"},{"USER_VIEW","/users"},
   {"ROLE_VIEW","/roles/permissions"},{"PRODUCT_VIEW","/products"},{"WAREHOUSE_VIEW","/warehouses"},
   {"BRAND_VIEW","/brands"},{"CATEGORY_VIEW","/categories"},{"INVENTORY_VIEW","/inventory/balances"},
   {"SUPPLIER_VIEW","/suppliers"},{"GRN_VIEW","/grns"},{"GTN_VIEW","/gtns"},{"PRN_VIEW","/purchase-returns"},
   {"QUOTATION_VIEW","/quotations"},{"PAYMENT_VIEW","/payments"},{"DELIVERY_VIEW","/deliveries"},
   {"REPORT_VIEW","/reports/day-summary"},{"AUDIT_VIEW","/reports/day-summary"}};
  for(String[] entry:cases){String bearer=token(staff(entry[0]));
   mvc.perform(get("/api/v1"+entry[1]).header("Authorization","Bearer "+bearer)).andExpect(status().isOk());
   mvc.perform(post("/api/v1/roles").header("Authorization","Bearer "+bearer).contentType("application/json").content("{\"name\":\"SHOULD_NOT_BE_CREATED\",\"permissions\":[]}")).andExpect(status().isForbidden());
  }
 }
 @Test void writePermissionsCanReadTheirOwnRecordsAndWorkflowReferences() throws Exception {
  String[][] cases={{"ROLE_MANAGE","/roles/permissions"},{"CUSTOMER_MANAGE","/customers"},{"PRODUCT_MANAGE","/products"},
   {"BRAND_MANAGE","/brands"},{"CATEGORY_MANAGE","/categories"},{"WAREHOUSE_MANAGE","/warehouses"},
   {"QUOTATION_MANAGE","/quotations"},{"PAYMENT_CREATE","/payments"},{"INVENTORY_MANAGE","/inventory/balances"},
   {"GRN_PROCESS","/products"},{"GRN_PROCESS","/warehouses"},{"GRN_PROCESS","/suppliers"},
   {"CUSTOMER_TARGET_MANAGE","/customer-targets"},{"CUSTOMER_TARGET_MANAGE","/customer-ranges"},
   {"DELIVERY_MANAGE","/users/lookup"},{"INVENTORY_MANAGE","/users/pos-staff"}};
  for(String[] entry:cases)mvc.perform(get("/api/v1"+entry[1]).header("Authorization","Bearer "+token(staff(entry[0])))).andExpect(status().isOk());
 }
 @Test void clearingRolesRevokesPermissionsAndOmittingRolesPreservesAssignments(){
  User staff=staff("PRODUCT_VIEW");asAdmin();UpdateUserRequest request=new UpdateUserRequest();request.setEmail(staff.getEmail());request.setFullName(staff.getFullName());
  userService.updateUser(staff.getId(),request);assertFalse(staff.getRoles().isEmpty());
  request.setRoles(Set.of());userService.updateUser(staff.getId(),request);assertTrue(staff.getRoles().isEmpty());assertTrue(UserPrincipal.create(staff).getAuthorities().isEmpty());
 }
 @Test void changedRolePermissionsApplyToExistingAccessTokens() throws Exception {
  User staff=staff("QUOTATION_VIEW");String bearer=token(staff);Role role=staff.getRoles().iterator().next();
  mvc.perform(get("/api/v1/quotations").header("Authorization","Bearer "+bearer)).andExpect(status().isOk());
  asAdmin();UpdateRoleRequest request=new UpdateRoleRequest();request.setDescription("Revoked access");request.setPermissions(List.of());roleService.updateRole(role.getId(),request);SecurityContextHolder.clearContext();
  mvc.perform(get("/api/v1/quotations").header("Authorization","Bearer "+bearer)).andExpect(status().isForbidden());
 }
 @Test void unknownPermissionsCannotBeSilentlySaved(){
  User staff=staff("PRODUCT_VIEW");asAdmin();UpdateRoleRequest request=new UpdateRoleRequest();request.setPermissions(List.of("MISSING_PERMISSION"));
  assertThrows(com.nbh.erp.common.exception.ResourceNotFoundException.class,()->roleService.updateRole(staff.getRoles().iterator().next().getId(),request));
 }
 @Test void assigningAnotherRoleReplacesModuleAccessForTheExistingSession() throws Exception {
  User employee=staff("PRODUCT_VIEW");String bearer=token(employee);asAdmin();
  var request=new com.nbh.erp.role.dto.CreateRoleRequest("ROLE_DELIVERY_"+UUID.randomUUID(),"Delivery staff",List.of("DELIVERY_VIEW"));
  var savedRole=roleService.createRole(request);
  UpdateUserRequest update=new UpdateUserRequest();update.setFullName(employee.getFullName());update.setEmail(employee.getEmail());update.setRoles(Set.of(savedRole.getName()));
  userService.updateUser(employee.getId(),update);SecurityContextHolder.clearContext();
  mvc.perform(get("/api/v1/deliveries").header("Authorization","Bearer "+bearer)).andExpect(status().isOk());
  mvc.perform(get("/api/v1/products").header("Authorization","Bearer "+bearer)).andExpect(status().isForbidden());
 }
 @Test void workflowStaffLookupDoesNotGrantEmployeeManagementOrExposeContactDetails() throws Exception {
  String bearer=token(staff("DELIVERY_MANAGE"));
  mvc.perform(get("/api/v1/users/lookup").header("Authorization","Bearer "+bearer)).andExpect(status().isOk()).andExpect(jsonPath("$.data[0].email").doesNotExist()).andExpect(jsonPath("$.data[0].permissions").doesNotExist());
  mvc.perform(get("/api/v1/users").header("Authorization","Bearer "+bearer)).andExpect(status().isForbidden());
 }
 @Test void posStaffMustHaveBillingPermissionInsteadOfOnlyAStaffRoleName(){
  User viewer=staff("SALES_VIEW"),cashier=staff("SALES_CREATE");
  var eligible=userService.getPosStaff().stream().map(com.nbh.erp.user.dto.UserDto::getId).toList();
  assertFalse(eligible.contains(viewer.getId()));assertTrue(eligible.contains(cashier.getId()));
 }
 @Test void administratorCannotGrantLegacySuperAdministratorAlias(){
  asAdmin();Role legacy=Role.builder().name("SUPER_ADMIN").permissions(new HashSet<>()).build();
  assertThrows(org.springframework.security.access.AccessDeniedException.class,()->com.nbh.erp.security.SecurityUtils.checkRoleGrant(legacy));
 }
}
