# OoTD MCP server (identify_outfit + estimate_price).
# Build from the REPO ROOT so the api/ module is in context:
#   docker build -f api/cmd/mcp/Dockerfile -t ghcr.io/ini-amin/ootd-identify-outfit:0.2.0 .
# Run (stdio):
#   docker run -i --rm -e AI_BASE_URL=... -e AI_API_KEY=... \
#     -e AI_VISION_MODEL=... -e AI_CHAT_MODEL=... ghcr.io/ini-amin/ootd-identify-outfit:0.2.0
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY api/go.mod api/go.sum ./
RUN go mod download
COPY api/ .
RUN CGO_ENABLED=0 go build -trimpath -o /ootd-mcp ./cmd/mcp

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /ootd-mcp /ootd-mcp
ENTRYPOINT ["/ootd-mcp"]
