package com.nbh.erp;

import com.nbh.erp.delivery.dto.CreateVehicleRequest;
import com.nbh.erp.delivery.entity.DeliveryRoute;
import com.nbh.erp.delivery.repository.DeliveryRouteRepository;
import com.nbh.erp.delivery.repository.VehicleRepository;
import com.nbh.erp.delivery.service.VehicleService;
import com.nbh.erp.delivery.service.DeliveryRouteService;
import com.nbh.erp.recyclebin.RecycleBinService;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest @Transactional
class DeliveryRecycleBinTest {
 @Autowired VehicleService vehicles;
 @Autowired VehicleRepository vehicleRecords;
 @Autowired DeliveryRouteService routes;
 @Autowired DeliveryRouteRepository routeRecords;
 @Autowired UserRepository users;
 @Autowired RecycleBinService bin;
 @Autowired EntityManager em;

 @Test void draftsAndDeliveryRecordsCanBeRestoredWithoutLosingAssignmentsOrHistory() {
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("delivery-manager","",List.of(new SimpleGrantedAuthority("DELIVERY_MANAGE"))));
  try {
   var staff=users.save(User.builder().username("vehicle-recycle-staff").email("vehicle-recycle@example.test").password("unused").fullName("Vehicle owner").isActive(true).approvalStatus("APPROVED").build());
   var draft=vehicles.createVehicle(CreateVehicleRequest.builder().model("Unfinished vehicle").draft(true).build());
   em.flush();em.clear();
   assertEquals("DRAFT",vehicles.getVehicleById(draft.getId()).getStatus());
   bin.delete("VEHICLE",draft.getId());em.flush();
   assertFalse(vehicleRecords.findAll().stream().anyMatch(row->row.getId().equals(draft.getId())));
   assertTrue(bin.list().stream().anyMatch(row->row.type().equals("VEHICLE") && row.id().equals(draft.getId())));
   bin.restore("VEHICLE",draft.getId());em.flush();
   assertEquals("DRAFT",vehicles.getVehicleById(draft.getId()).getStatus());
   assertFalse(vehicles.getVehicleById(draft.getId()).getIsActive());
   vehicles.updateVehicle(draft.getId(),CreateVehicleRequest.builder().vehicleNumber("RECYCLE-3W").model("Complete threewheel").vehicleType("THREEWHEEL").assignedStaffId(staff.getId()).draft(true).build());
   assertEquals("AVAILABLE",vehicles.changeStatus(draft.getId(),"AVAILABLE","Ready for delivery").getStatus());
   bin.delete("VEHICLE",draft.getId());em.flush();bin.restore("VEHICLE",draft.getId());em.flush();
   assertEquals(staff.getId(),vehicles.getVehicleById(draft.getId()).getAssignedStaffId());
   assertEquals("AVAILABLE",vehicles.getVehicleById(draft.getId()).getStatus());

   var route=routeRecords.save(DeliveryRoute.builder().routeCode("RECYCLE-ROUTE").routeName("Preserved route").area("Colombo").build());
   var customer=com.nbh.erp.customer.entity.Customer.builder().customerCode("RECYCLE-ROUTE-CU").name("Route customer").deliveryRoute(route).build();
   em.persist(customer);em.flush();
   bin.delete("DELIVERY_ROUTE",route.getId());em.flush();
   assertFalse(routeRecords.findAll().stream().anyMatch(row->row.getId().equals(route.getId())));
   var entry=bin.list().stream().filter(row->row.type().equals("DELIVERY_ROUTE") && row.id().equals(route.getId())).findFirst().orElseThrow();
   assertEquals("RECYCLE-ROUTE",entry.code());assertEquals("Preserved route",entry.name());
   bin.restore("DELIVERY_ROUTE",route.getId());em.flush();
   assertEquals(List.of(customer.getId()),routes.getRouteById(route.getId()).getCustomerIds());
   assertEquals("Colombo",routes.changeStatus(route.getId(),"INACTIVE","Season finished").getArea());
   bin.delete("DELIVERY_ROUTE",route.getId());em.flush();bin.restore("DELIVERY_ROUTE",route.getId());em.flush();
   assertFalse(routes.getRouteById(route.getId()).getIsActive());
   bin.delete("DELIVERY_ROUTE",route.getId());em.flush();bin.purge("DELIVERY_ROUTE",route.getId());em.flush();
   assertEquals(route.getId(),customer.getDeliveryRoute().getId());
   assertFalse(bin.list().stream().anyMatch(row->row.type().equals("DELIVERY_ROUTE") && row.id().equals(route.getId())));
   bin.delete("VEHICLE",draft.getId());em.flush();bin.purge("VEHICLE",draft.getId());em.flush();
   assertTrue(vehicleRecords.findById(draft.getId()).isPresent(),"Historical vehicle references remain valid");
  } finally {SecurityContextHolder.clearContext();}
 }
}
