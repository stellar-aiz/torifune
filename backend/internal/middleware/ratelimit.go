package middleware

import (
	"net"
	"net/http"
	"sync"
	"time"
)

// RateLimitConfig holds the configuration for the rate limiting middleware.
type RateLimitConfig struct {
	// RequestsPerMinute is the maximum number of requests allowed per minute per IP.
	// Default is 100 if not specified.
	RequestsPerMinute int
}

// rateLimitEntry tracks request counts for a single IP.
type rateLimitEntry struct {
	count     int
	expiresAt time.Time
}

// rateLimiter manages rate limiting state.
type rateLimiter struct {
	mu                sync.RWMutex
	entries           map[string]*rateLimitEntry
	requestsPerMinute int
	window            time.Duration
}

// newRateLimiter creates a new rate limiter instance.
func newRateLimiter(requestsPerMinute int) *rateLimiter {
	if requestsPerMinute <= 0 {
		requestsPerMinute = 100 // default
	}

	rl := &rateLimiter{
		entries:           make(map[string]*rateLimitEntry),
		requestsPerMinute: requestsPerMinute,
		window:            time.Minute,
	}

	// Start cleanup goroutine
	go rl.cleanup()

	return rl
}

// allow checks if the request from the given IP is allowed.
// Returns true if allowed, false if rate limited.
func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	entry, exists := rl.entries[ip]

	// If entry doesn't exist or has expired, create a new one
	if !exists || now.After(entry.expiresAt) {
		rl.entries[ip] = &rateLimitEntry{
			count:     1,
			expiresAt: now.Add(rl.window),
		}
		return true
	}

	// Check if limit exceeded
	if entry.count >= rl.requestsPerMinute {
		return false
	}

	// Increment counter
	entry.count++
	return true
}

// cleanup periodically removes expired entries to prevent memory leaks.
func (rl *rateLimiter) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, entry := range rl.entries {
			if now.After(entry.expiresAt) {
				delete(rl.entries, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// RateLimit creates a rate limiting middleware.
// It limits requests per IP address using an in-memory store.
func RateLimit(cfg RateLimitConfig) func(http.Handler) http.Handler {
	limiter := newRateLimiter(cfg.RequestsPerMinute)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := getClientIP(r)

			if !limiter.allow(ip) {
				w.Header().Set("Retry-After", "60")
				http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// getClientIP extracts the client IP address from the request.
// It checks X-Forwarded-For and X-Real-IP headers first for proxied requests.
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header (may contain multiple IPs)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP in the list
		if idx := len(xff); idx > 0 {
			for i, c := range xff {
				if c == ',' {
					return xff[:i]
				}
			}
			return xff
		}
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}
