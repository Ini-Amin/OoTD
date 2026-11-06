package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ootd/ootd-api/internal/ai"
	"github.com/ootd/ootd-api/internal/httpapi"
	"github.com/ootd/ootd-api/migrations"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is required, e.g. postgres://ootd@/ootd?host=/tmp&port=5433")
	}

	supabaseURL := os.Getenv("SUPABASE_URL")
	if supabaseURL == "" {
		log.Fatal("SUPABASE_URL is required")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("database config: %v", err)
	}
	defer pool.Close()

	if err := migrations.Apply(ctx, pool); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	auth, err := httpapi.NewAuthenticator(supabaseURL)
	if err != nil {
		log.Fatalf("authenticator: %v", err)
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	origin := os.Getenv("ALLOWED_ORIGIN")
	if origin == "" {
		origin = "http://localhost:5173"
	}

	go httpapi.RunIngestWorker(ctx, pool, ai.NewClientFromEnv(), httpapi.IngestWorkerIntervalFromEnv())

	server := &http.Server{
		Addr:    ":" + port,
		Handler: httpapi.NewServer(pool, auth, origin),
	}

	log.Printf("OoTD API listening on http://localhost:%s", port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("API server failed: %v", err)
	}
}
