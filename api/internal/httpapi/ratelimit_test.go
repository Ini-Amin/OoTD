package httpapi

import (
	"testing"
	"time"
)

func TestLimiterAllowsUpToMax(t *testing.T) {
	l := newLimiter()
	for i := 0; i < 5; i++ {
		if ok, _ := l.allow("u1", 5, time.Hour); !ok {
			t.Fatalf("call %d: expected allow", i+1)
		}
	}
	if ok, retry := l.allow("u1", 5, time.Hour); ok {
		t.Fatal("6th call: expected deny")
	} else if retry <= 0 || retry > time.Hour {
		t.Fatalf("unexpected retry-after %v", retry)
	}
}

func TestLimiterIsolatesKeys(t *testing.T) {
	l := newLimiter()
	if ok, _ := l.allow("u1", 1, time.Hour); !ok {
		t.Fatal("u1 first call: expected allow")
	}
	if ok, _ := l.allow("u1", 1, time.Hour); ok {
		t.Fatal("u1 second call: expected deny")
	}
	if ok, _ := l.allow("u2", 1, time.Hour); !ok {
		t.Fatal("u2 first call: expected allow")
	}
}

func TestLimiterWindowExpiry(t *testing.T) {
	l := newLimiter()
	if ok, _ := l.allow("u1", 1, 50*time.Millisecond); !ok {
		t.Fatal("first call: expected allow")
	}
	if ok, _ := l.allow("u1", 1, 50*time.Millisecond); ok {
		t.Fatal("immediate second call: expected deny")
	}
	time.Sleep(60 * time.Millisecond)
	if ok, _ := l.allow("u1", 1, 50*time.Millisecond); !ok {
		t.Fatal("call after window: expected allow")
	}
}
