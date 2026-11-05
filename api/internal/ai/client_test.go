package ai

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// stubCompletions serves one canned reply and captures the outbound request.
func stubCompletions(t *testing.T) (*httptest.Server, *chatRequest) {
	t.Helper()
	var got chatRequest
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Errorf("unexpected path %q", r.URL.Path)
		}
		body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
		if err != nil {
			t.Fatalf("read body: %v", err)
		}
		if err := json.Unmarshal(body, &got); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"choices":[{"message":{"content":"wear it"}}]}`)
	}))
	t.Cleanup(srv.Close)
	return srv, &got
}

func testClient(srv *httptest.Server) *Client {
	return &Client{baseURL: srv.URL, apiKey: "test-key", chatModel: "test-model", http: srv.Client()}
}

func systemText(t *testing.T, req *chatRequest) string {
	t.Helper()
	if len(req.Messages) == 0 || req.Messages[0].Role != "system" {
		t.Fatal("first outbound message must be the system prompt")
	}
	content := req.Messages[0].Content
	if len(content) != 1 || content[0].Type != "text" {
		t.Fatalf("system message must hold one text block, got %+v", content)
	}
	return content[0].Text
}

func TestStylistReplyEmptyClosetKeepsSystemVerbatim(t *testing.T) {
	srv, got := stubCompletions(t)
	c := testClient(srv)
	reply, err := c.StylistReply([][2]string{{"user", "hi"}}, "what to wear?", nil)
	if err != nil {
		t.Fatalf("StylistReply: %v", err)
	}
	if reply != "wear it" {
		t.Fatalf("unexpected reply %q", reply)
	}
	if sys := systemText(t, got); sys != StylistSystemPrompt {
		t.Fatal("empty closet must send StylistSystemPrompt byte-verbatim")
	}
}

func TestStylistReplyWiresClosetIntoSystem(t *testing.T) {
	srv, got := stubCompletions(t)
	c := testClient(srv)
	_, err := c.StylistReply(nil, "what to wear to kampus?", []ClosetPiece{
		{Category: "top", Label: "Olive trench coat"},
	})
	if err != nil {
		t.Fatalf("StylistReply: %v", err)
	}
	sys := systemText(t, got)
	if !strings.HasPrefix(sys, StylistSystemPrompt) {
		t.Fatal("system must start with StylistSystemPrompt")
	}
	if !strings.Contains(sys, `<closet>`) || !strings.Contains(sys, `- [top] "Olive trench coat"`) {
		t.Fatalf("closet block missing from system prompt: %q", sys)
	}
}
