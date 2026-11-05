package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"
)

// Minimal JSON-RPC 2.0 + MCP method surface. Only what this server needs:
// initialize, notifications/initialized, tools/list, tools/call.

const protocolVersion = "2024-11-05"

// JSON-RPC wire types.

type rpcRequest struct {
	JSONRPC string           `json:"jsonrpc"`
	ID      *json.RawMessage `json:"id,omitempty"`
	Method  string           `json:"method"`
	Params  json.RawMessage  `json:"params,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type rpcResponse struct {
	JSONRPC string           `json:"jsonrpc"`
	ID      *json.RawMessage `json:"id,omitempty"`
	Result  any              `json:"result,omitempty"`
	Error   *rpcError        `json:"error,omitempty"`
}

// MCP result shapes.

type serverInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type initializeResult struct {
	ProtocolVersion string         `json:"protocolVersion"`
	Capabilities    map[string]any `json:"capabilities"`
	ServerInfo      serverInfo     `json:"serverInfo"`
}

type mcpTool struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	InputSchema any    `json:"inputSchema"`
}

type contentText struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type callResult struct {
	Content []contentText `json:"content"`
	IsError bool          `json:"isError,omitempty"`
}

// readMessage reads one JSON-RPC message from r. It accepts both
// Content-Length framed messages and single-line (newline-delimited) JSON.
// It reports whether the message arrived Content-Length framed so the
// response can mirror the same framing.
func readMessage(r *bufio.Reader) (msg []byte, framed bool, err error) {
	for {
		line, err := r.ReadString('\n')
		if err != nil {
			if err == io.EOF && strings.TrimSpace(line) != "" {
				return []byte(strings.TrimSpace(line)), false, nil
			}
			return nil, false, err
		}
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		if name, value, ok := cutHeader(trimmed); ok && strings.EqualFold(name, "Content-Length") {
			n, err := strconv.Atoi(strings.TrimSpace(value))
			if err != nil || n < 0 {
				return nil, false, fmt.Errorf("bad Content-Length %q", value)
			}
			// Consume remaining header lines up to the blank line.
			for {
				h, err := r.ReadString('\n')
				if err != nil {
					return nil, false, err
				}
				if strings.TrimSpace(h) == "" {
					break
				}
			}
			body := make([]byte, n)
			if _, err := io.ReadFull(r, body); err != nil {
				return nil, false, err
			}
			return body, true, nil
		}
		return []byte(trimmed), false, nil
	}
}

// writeMessage writes one JSON-RPC response, mirroring the request framing:
// Content-Length headers when framed, otherwise a single line of JSON.
func writeMessage(w *bufio.Writer, v any, framed bool) error {
	body, err := json.Marshal(v)
	if err != nil {
		return err
	}
	if framed {
		if _, err := fmt.Fprintf(w, "Content-Length: %d\r\n\r\n", len(body)); err != nil {
			return err
		}
	}
	if _, err := w.Write(body); err != nil {
		return err
	}
	_, err = w.Write([]byte{'\n'})
	return err
}

func cutHeader(line string) (name, value string, ok bool) {
	i := strings.IndexByte(line, ':')
	if i <= 0 {
		return "", "", false
	}
	return strings.TrimSpace(line[:i]), strings.TrimSpace(line[i+1:]), true
}

func newErrorResponse(id *json.RawMessage, code int, msg string) *rpcResponse {
	return &rpcResponse{JSONRPC: "2.0", ID: id, Error: &rpcError{Code: code, Message: msg}}
}
