// Command mcp is OoTD's MCP server exposing identify_outfit + estimate_price.
//
// It reuses the same AI client as the HTTP API (internal/ai) so Magic Tag
// behavior stays identical: identify_outfit calls AnalyzeOutfit on a public
// image URL and returns sanitized pieces with marketplace search links,
// while estimate_price calls EstimatePrice for a low-confidence IDR range.
// Only stdio framing and JSON-RPC dispatch live here; no AI logic is
// duplicated.
//
// Transport: newline-delimited JSON-RPC over stdio (the MCP standard).
// Content-Length framed messages (LSP style) are also accepted on input,
// and responses mirror the framing of the request that triggered them.
package main

import (
	"bufio"
	"fmt"
	"io"
	"log"
	"os"

	"github.com/ootd/ootd-api/internal/ai"
)

func main() {
	log.SetOutput(os.Stderr)

	client := ai.NewClientFromEnv()
	if client == nil {
		log.Print("mcp: AI_API_KEY not set; tools will report ai-not-configured")
	}

	in := bufio.NewReader(os.Stdin)
	out := bufio.NewWriter(os.Stdout)
	defer out.Flush()

	for {
		msg, framed, err := readMessage(in)
		if err != nil {
			if err == io.EOF || err == io.ErrUnexpectedEOF {
				return
			}
			log.Printf("mcp: read: %v", err)
			return
		}
		resp := handleMessage(client, msg)
		if resp == nil {
			continue // notification: no response
		}
		if err := writeMessage(out, resp, framed); err != nil {
			log.Printf("mcp: write: %v", err)
			return
		}
		if err := out.Flush(); err != nil {
			fmt.Fprintf(os.Stderr, "mcp: flush: %v\n", err)
			return
		}
	}
}
