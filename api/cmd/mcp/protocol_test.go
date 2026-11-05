package main

import (
	"bufio"
	"bytes"
	"strings"
	"testing"
)

func TestReadMessageLineDelimited(t *testing.T) {
	r := bufio.NewReader(strings.NewReader("\n{\"jsonrpc\":\"2.0\",\"id\":1}\n"))
	msg, framed, err := readMessage(r)
	if err != nil {
		t.Fatal(err)
	}
	if framed {
		t.Fatal("expected unframed message")
	}
	if string(msg) != `{"jsonrpc":"2.0","id":1}` {
		t.Fatalf("unexpected msg %q", msg)
	}
}

func TestReadMessageContentLength(t *testing.T) {
	body := `{"jsonrpc":"2.0","id":2,"method":"tools/list"}`
	raw := "Content-Length: " + itoa(len(body)) + "\r\n\r\n" + body
	r := bufio.NewReader(strings.NewReader(raw))
	msg, framed, err := readMessage(r)
	if err != nil {
		t.Fatal(err)
	}
	if !framed {
		t.Fatal("expected framed message")
	}
	if string(msg) != body {
		t.Fatalf("unexpected msg %q", msg)
	}
}

func TestReadMessageContentLengthWithExtraHeaders(t *testing.T) {
	body := `{}`
	raw := "Content-Length: 2\r\nContent-Type: application/json\r\n\r\n" + body
	r := bufio.NewReader(strings.NewReader(raw))
	msg, framed, err := readMessage(r)
	if err != nil {
		t.Fatal(err)
	}
	if !framed || string(msg) != body {
		t.Fatalf("unexpected %v %q", framed, msg)
	}
}

func TestWriteMessageFraming(t *testing.T) {
	var buf bytes.Buffer
	w := bufio.NewWriter(&buf)
	v := map[string]string{"hello": "world"}
	if err := writeMessage(w, v, true); err != nil {
		t.Fatal(err)
	}
	w.Flush()
	out := buf.String()
	if !strings.HasPrefix(out, "Content-Length: ") {
		t.Fatalf("missing header: %q", out)
	}
	if !strings.HasSuffix(out, "\n") || !strings.Contains(out, `"hello":"world"`) {
		t.Fatalf("bad body: %q", out)
	}

	buf.Reset()
	w = bufio.NewWriter(&buf)
	if err := writeMessage(w, v, false); err != nil {
		t.Fatal(err)
	}
	w.Flush()
	if strings.Contains(buf.String(), "Content-Length") || buf.String() != "{\"hello\":\"world\"}\n" {
		t.Fatalf("bad line message: %q", buf.String())
	}
}

func TestHandleInitialize(t *testing.T) {
	resp := handleMessage(nil, []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}`))
	if resp == nil || resp.Error != nil {
		t.Fatalf("expected result, got %+v", resp)
	}
}

func TestHandleNotificationIgnored(t *testing.T) {
	resp := handleMessage(nil, []byte(`{"jsonrpc":"2.0","method":"notifications/initialized"}`))
	if resp != nil {
		t.Fatalf("expected nil response, got %+v", resp)
	}
}

func TestHandleUnknownMethod(t *testing.T) {
	resp := handleMessage(nil, []byte(`{"jsonrpc":"2.0","id":9,"method":"nope"}`))
	if resp == nil || resp.Error == nil || resp.Error.Code != -32601 {
		t.Fatalf("expected -32601, got %+v", resp)
	}
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [32]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}
