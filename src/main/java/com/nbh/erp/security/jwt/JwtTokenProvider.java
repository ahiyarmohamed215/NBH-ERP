package com.nbh.erp.security.jwt;
import com.nbh.erp.security.UserPrincipal;
import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import javax.crypto.SecretKey;
import java.util.*;
@Component
public class JwtTokenProvider {
 private final SecretKey key;
 private final long accessMs, refreshMs;
 public JwtTokenProvider(@Value("${app.jwt.secret}") String secret,
   @Value("${app.jwt.access-token-expiration-ms:900000}") long accessMs,
   @Value("${app.jwt.refresh-token-expiration-ms:604800000}") long refreshMs) {
  key=Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret)); this.accessMs=accessMs; this.refreshMs=refreshMs;
 }
 public String generateAccessToken(Authentication authentication) {
  UserPrincipal p=(UserPrincipal)authentication.getPrincipal();
  return builder(p.getUsername(),p.getTokenVersion(),"ACCESS",accessMs).compact();
 }
 public String generateRefreshToken(String username,long version,String sessionId,String tokenId) {
  return builder(username,version,"REFRESH",refreshMs).claim("sid",sessionId).id(tokenId).compact();
 }
 private JwtBuilder builder(String username,long version,String type,long duration) {
  Date now=new Date();
  return Jwts.builder().subject(username).claim("version",version).claim("type",type)
    .issuedAt(now).expiration(new Date(now.getTime()+duration)).signWith(key);
 }
 public Claims claims(String token) { return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload(); }
 public String getUsernameFromToken(String token) { return claims(token).getSubject(); }
 public boolean validateToken(String token,String type) {
  try { return type.equals(claims(token).get("type",String.class)); } catch (JwtException|IllegalArgumentException e) { return false; }
 }
 public boolean matchesVersion(String token,long version) {
  Number n=claims(token).get("version",Number.class); return n!=null && n.longValue()==version;
 }
 public long getRefreshMs() { return refreshMs; }
}
