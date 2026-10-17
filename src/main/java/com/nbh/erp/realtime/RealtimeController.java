package com.nbh.erp.realtime;

import com.nbh.erp.security.UserPrincipal;
import com.nbh.erp.security.jwt.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/api/v1/events")
@RequiredArgsConstructor
public class RealtimeController {
    private final RealtimeStreams streams;
    private final JwtTokenProvider tokens;

    @GetMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events(@AuthenticationPrincipal UserPrincipal principal,
            @RequestHeader("Authorization") String authorization, HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store, no-transform");
        response.setHeader("X-Accel-Buffering", "no");
        return streams.connect(principal, tokens.claims(authorization.substring(7)).getExpiration().getTime());
    }
}
