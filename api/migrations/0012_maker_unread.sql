-- Per-maker read state for craft requests (broadcast inbox: every maker sees
-- every request, so read state must be a join table, not a shared column).
CREATE TABLE maker_request_reads (
    maker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id uuid NOT NULL REFERENCES craft_requests(id) ON DELETE CASCADE,
    read_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (maker_id, request_id)
);
CREATE INDEX maker_request_reads_maker_idx ON maker_request_reads (maker_id);
