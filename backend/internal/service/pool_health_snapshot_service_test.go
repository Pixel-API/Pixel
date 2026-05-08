//go:build unit

package service

import (
	"context"
	"sync"
	"testing"
	"time"
)

type fakePoolHealthSnapshotSource struct {
	mu       sync.Mutex
	calls    int
	delay    time.Duration
	groups   []Group
	accounts []Account
	err      error
}

func (f *fakePoolHealthSnapshotSource) ListPoolHealthGroups(ctx context.Context) ([]Group, error) {
	f.mu.Lock()
	f.calls++
	delay := f.delay
	groups := append([]Group(nil), f.groups...)
	err := f.err
	f.mu.Unlock()
	if delay > 0 {
		select {
		case <-time.After(delay):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	return groups, err
}

func (f *fakePoolHealthSnapshotSource) ListPoolHealthAccounts(ctx context.Context) ([]Account, error) {
	f.mu.Lock()
	accounts := append([]Account(nil), f.accounts...)
	err := f.err
	f.mu.Unlock()
	return accounts, err
}

func (f *fakePoolHealthSnapshotSource) callCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.calls
}

func TestAdminServicePoolHealthSnapshotAggregatesPoolsAndSummary(t *testing.T) {
	now := time.Date(2026, 5, 8, 10, 0, 0, 0, time.UTC)
	lastUsed := now.Add(-30 * time.Minute)
	rateLimitedUntil := time.Now().Add(10 * time.Minute)
	fiveHourOpenAI := 40.0
	sevenDayOpenAI := 70.0
	fiveHourBackup := 20.0

	source := &fakePoolHealthSnapshotSource{
		groups: []Group{
			{ID: 1, Name: "OpenAI primary", Description: "main", Status: StatusActive},
			{ID: 2, Name: "Backup", Description: "fallback", Status: StatusDisabled},
		},
		accounts: []Account{
			{ID: 10, Name: "primary-a", Status: StatusActive, Schedulable: true, LastUsedAt: &lastUsed, GroupIDs: []int64{1}, Extra: map[string]any{"codex_5h_used_percent": fiveHourOpenAI, "codex_7d_used_percent": sevenDayOpenAI}},
			{ID: 11, Name: "primary-b", Status: StatusActive, Schedulable: true, RateLimitResetAt: &rateLimitedUntil, GroupIDs: []int64{1}},
			{ID: 12, Name: "primary-c", Status: StatusError, Schedulable: true, GroupIDs: []int64{1}},
			{ID: 13, Name: "backup-a", Status: StatusActive, Schedulable: true, GroupIDs: []int64{2}, Extra: map[string]any{"codex_5h_used_percent": fiveHourBackup}},
			{ID: 14, Name: "gemini-a", Platform: PlatformGemini, Status: StatusActive, Schedulable: true, GroupIDs: []int64{1}, Extra: map[string]any{"codex_5h_used_percent": 100.0}},
		},
	}
	svc := &adminServiceImpl{poolHealthSnapshotSource: source, poolHealthSnapshotTTL: time.Minute}
	svc.poolHealthSnapshotNow = func() time.Time { return now }

	snapshot, err := svc.GetPoolHealthSnapshot(context.Background())
	if err != nil {
		t.Fatalf("GetPoolHealthSnapshot error = %v", err)
	}

	if !snapshot.Enabled {
		t.Fatal("snapshot should be enabled")
	}
	if !snapshot.Timestamp.Equal(now) {
		t.Fatalf("timestamp = %s, want %s", snapshot.Timestamp, now)
	}
	if snapshot.Summary.TotalPools != 2 || snapshot.Summary.TotalAccounts != 4 || snapshot.Summary.ActiveAccounts != 3 || snapshot.Summary.SchedulableAccounts != 2 || snapshot.Summary.RateLimitedAccounts != 1 || snapshot.Summary.ProblemAccounts != 2 {
		t.Fatalf("unexpected summary counts: %+v", snapshot.Summary)
	}
	if snapshot.Summary.Codex5hAverage == nil || *snapshot.Summary.Codex5hAverage != 30.0 {
		t.Fatalf("codex 5h average = %v, want 30", snapshot.Summary.Codex5hAverage)
	}
	if snapshot.Summary.Codex7dAverage == nil || *snapshot.Summary.Codex7dAverage != 70.0 {
		t.Fatalf("codex 7d average = %v, want 70", snapshot.Summary.Codex7dAverage)
	}
	if len(snapshot.Pools) != 2 {
		t.Fatalf("len(pools) = %d, want 2", len(snapshot.Pools))
	}

	primary := snapshot.Pools[0]
	if primary.ID != 1 || primary.Name != "OpenAI primary" || primary.Description != "main" || primary.Status != StatusActive {
		t.Fatalf("unexpected primary pool identity: %+v", primary)
	}
	if primary.TotalAccounts != 3 || primary.ActiveAccounts != 2 || primary.SchedulableAccounts != 1 || primary.RateLimitedAccounts != 1 || primary.ProblemAccounts != 2 {
		t.Fatalf("unexpected primary counts: %+v", primary)
	}
	if primary.Codex5hAverage == nil || *primary.Codex5hAverage != 40.0 || primary.Codex7dAverage == nil || *primary.Codex7dAverage != 70.0 {
		t.Fatalf("unexpected primary codex averages: %+v %+v", primary.Codex5hAverage, primary.Codex7dAverage)
	}
	if primary.LastUsedAt == nil || !primary.LastUsedAt.Equal(lastUsed) {
		t.Fatalf("primary last_used_at = %v, want %s", primary.LastUsedAt, lastUsed)
	}
	if primary.Health != PoolHealthProblem {
		t.Fatalf("primary health = %q, want %q", primary.Health, PoolHealthProblem)
	}

	backup := snapshot.Pools[1]
	if backup.TotalAccounts != 1 || backup.ActiveAccounts != 1 || backup.SchedulableAccounts != 1 || backup.ProblemAccounts != 0 || backup.Health != PoolHealthDisabled {
		t.Fatalf("unexpected backup pool: %+v", backup)
	}
}

func TestAdminServicePoolHealthSnapshotCachesWithinTTL(t *testing.T) {
	now := time.Date(2026, 5, 8, 10, 0, 0, 0, time.UTC)
	source := &fakePoolHealthSnapshotSource{
		groups:   []Group{{ID: 1, Name: "Pool", Status: StatusActive}},
		accounts: []Account{{ID: 10, Status: StatusActive, Schedulable: true, GroupIDs: []int64{1}}},
	}
	svc := &adminServiceImpl{poolHealthSnapshotSource: source, poolHealthSnapshotTTL: time.Minute}
	svc.poolHealthSnapshotNow = func() time.Time { return now }

	first, err := svc.GetPoolHealthSnapshot(context.Background())
	if err != nil {
		t.Fatalf("first GetPoolHealthSnapshot error = %v", err)
	}
	source.groups[0].Name = "Changed"
	now = now.Add(59 * time.Second)
	second, err := svc.GetPoolHealthSnapshot(context.Background())
	if err != nil {
		t.Fatalf("second GetPoolHealthSnapshot error = %v", err)
	}
	if source.callCount() != 1 {
		t.Fatalf("repo calls within ttl = %d, want 1", source.callCount())
	}
	if second.Pools[0].Name != first.Pools[0].Name {
		t.Fatalf("cached pool name = %q, want %q", second.Pools[0].Name, first.Pools[0].Name)
	}

	now = now.Add(2 * time.Second)
	third, err := svc.GetPoolHealthSnapshot(context.Background())
	if err != nil {
		t.Fatalf("third GetPoolHealthSnapshot error = %v", err)
	}
	if source.callCount() != 2 {
		t.Fatalf("repo calls after ttl = %d, want 2", source.callCount())
	}
	if third.Pools[0].Name != "Changed" {
		t.Fatalf("refreshed pool name = %q, want Changed", third.Pools[0].Name)
	}
}

func TestAdminServicePoolHealthSnapshotConcurrentMissLoadsOnce(t *testing.T) {
	now := time.Date(2026, 5, 8, 10, 0, 0, 0, time.UTC)
	source := &fakePoolHealthSnapshotSource{
		delay:    20 * time.Millisecond,
		groups:   []Group{{ID: 1, Name: "Pool", Status: StatusActive}},
		accounts: []Account{{ID: 10, Status: StatusActive, Schedulable: true, GroupIDs: []int64{1}}},
	}
	svc := &adminServiceImpl{poolHealthSnapshotSource: source, poolHealthSnapshotTTL: time.Minute}
	svc.poolHealthSnapshotNow = func() time.Time { return now }

	var wg sync.WaitGroup
	errs := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := svc.GetPoolHealthSnapshot(context.Background())
			errs <- err
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatalf("GetPoolHealthSnapshot error = %v", err)
		}
	}
	if source.callCount() != 1 {
		t.Fatalf("repo calls for concurrent miss = %d, want 1", source.callCount())
	}
}
