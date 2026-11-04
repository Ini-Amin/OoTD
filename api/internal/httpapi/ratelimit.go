package httpapi

import (
	"net/http"
	"strconv"
	"sync"
	"time"
)

// limiter is a tiny in-memory fixed-window rate limiter. It is per-process
// state: good enough for a single API instance, and it caps AI spend without
// new dependencies. A multi-instance deployment needs a shared store instead.
type limiter struct {
	mu   sync.Mutex
	hits map[string][]time.Time
}

func newLimiter() *limiter {
	return &limiter{hits: make(map[string][]time.Time)}
}

// allow reports whether key may proceed under max events per window. When it
// reports false, retryAfter says how long to wait before retrying.
func (l *limiter) allow(key string, max int, window time.Duration) (bool, time.Duration) {
	now := time.Now()
	cutoff := now.Add(-window)
	l.mu.Lock()
	defer l.mu.Unlock()
	var kept []time.Time
	for _, t := range l.hits[key] {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= max {
		retry := kept[0].Add(window).Sub(now)
		if retry < 0 {
			retry = 0
		}
		l.hits[key] = kept
		return false, retry
	}
	l.hits[key] = append(kept, now)
	return true, 0
}

// checkLimit enforces max events per window for key. It writes a 429 with a
// Retry-After header and reports false when the caller must stop.
func (s *server) checkLimit(w http.ResponseWriter, key string, max int, window time.Duration) bool {
	ok, retry := s.aiLimiter.allow(key, max, window)
	if ok {
		return true
	}
	w.Header().Set("Retry-After", strconv.Itoa(int(retry/time.Second)+1))
	writeError(w, http.StatusTooManyRequests, "rate limited, try again later")
	return false
}
