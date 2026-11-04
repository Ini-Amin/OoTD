package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// Client talks to an OpenAI-compatible chat-completions endpoint.
// It is configured entirely from the environment so the same code works
// against Meta Model API, Baseten, or any OpenAI-compatible provider:
//
//	AI_BASE_URL     e.g. https://api.meta.ai/... (no trailing slash)
//	AI_API_KEY      secret key
//	AI_VISION_MODEL model id for Magic Tag (image analysis)
//	AI_CHAT_MODEL   model id for the AI Stylist chat
//	AI_TIMEOUT_SECS request timeout, default 60
type Client struct {
	baseURL     string
	apiKey      string
	visionModel string
	chatModel   string
	http        *http.Client
}

// NewClientFromEnv returns nil when AI is not configured (no API key),
// letting handlers degrade gracefully with 503 instead of crashing.
func NewClientFromEnv() *Client {
	key := os.Getenv("AI_API_KEY")
	if key == "" {
		return nil
	}
	timeoutSecs := 60
	if v := os.Getenv("AI_TIMEOUT_SECS"); v != "" {
		var n int
		if _, err := fmt.Sscanf(v, "%d", &n); err == nil && n > 0 {
			timeoutSecs = n
		}
	}
	return &Client{
		baseURL:     os.Getenv("AI_BASE_URL"),
		apiKey:      key,
		visionModel: os.Getenv("AI_VISION_MODEL"),
		chatModel:   os.Getenv("AI_CHAT_MODEL"),
		http:        &http.Client{Timeout: time.Duration(timeoutSecs) * time.Second},
	}
}

type messageContent struct {
	Type     string    `json:"type"`
	Text     string    `json:"text,omitempty"`
	ImageURL *imageURL `json:"image_url,omitempty"`
}

type imageURL struct {
	URL string `json:"url"`
}

type chatMessage struct {
	Role    string           `json:"role"`
	Content []messageContent `json:"content"`
}

type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	Temperature float64       `json:"temperature,omitempty"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func textMsg(role, text string) chatMessage {
	return chatMessage{Role: role, Content: []messageContent{{Type: "text", Text: text}}}
}

func (c *Client) complete(model string, messages []chatMessage, maxTokens int) (string, error) {
	body, err := json.Marshal(chatRequest{
		Model:       model,
		Messages:    messages,
		Temperature: 0.4,
		MaxTokens:   maxTokens,
	})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequest(http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("ai request: %w", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ai status %d: %s", resp.StatusCode, truncate(string(raw), 300))
	}
	var out chatResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", fmt.Errorf("ai decode: %w", err)
	}
	if out.Error != nil {
		return "", fmt.Errorf("ai error: %s", out.Error.Message)
	}
	if len(out.Choices) == 0 {
		return "", fmt.Errorf("ai: empty choices")
	}
	return out.Choices[0].Message.Content, nil
}

// AnalyzeOutfit runs Magic Tag on a public image URL.
func (c *Client) AnalyzeOutfit(imgURL string) (string, error) {
	msgs := []chatMessage{
		textMsg("system", MagicTagSystemPrompt),
		{
			Role: "user",
			Content: []messageContent{
				{Type: "text", Text: MagicTagUserPrompt},
				{Type: "image_url", ImageURL: &imageURL{URL: imgURL}},
			},
		},
	}
	return c.complete(c.visionModel, msgs, 1500)
}

// StylistReply runs one turn of the AI Stylist chat.
// history holds prior turns as {role, content} pairs (roles: user/assistant).
func (c *Client) StylistReply(history [][2]string, userText string) (string, error) {
	msgs := []chatMessage{textMsg("system", StylistSystemPrompt)}
	for _, h := range history {
		role := h[0]
		if role != "user" && role != "assistant" {
			continue
		}
		msgs = append(msgs, textMsg(role, h[1]))
	}
	msgs = append(msgs, textMsg("user", userText))
	return c.complete(c.chatModel, msgs, 800)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
