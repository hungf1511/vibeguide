import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { createSnapshot, listSnapshots, restoreSnapshot, getSnapshot } from "../src/utils/snapshot.js";

const FIXTURE = path.resolve("tests/fixtures/small-repo");
const SNAPSHOT_DIR = path.resolve(process.cwd(), "cache", "snapshots");

describe("snapshot", () => {
  let snapId: string;

  beforeEach(() => {
    // Ensure clean snapshot dir state for fixture
    const prefix = createHash("sha256").update(FIXTURE).digest("hex").slice(0, 16);
    if (fs.existsSync(SNAPSHOT_DIR)) {
      for (const f of fs.readdirSync(SNAPSHOT_DIR)) {
        if (f.startsWith(prefix)) fs.unlinkSync(path.join(SNAPSHOT_DIR, f));
      }
    }
  });

  afterEach(() => {
    const prefix = createHash("sha256").update(FIXTURE).digest("hex").slice(0, 16);
    if (fs.existsSync(SNAPSHOT_DIR)) {
      for (const f of fs.readdirSync(SNAPSHOT_DIR)) {
        if (f.startsWith(prefix)) fs.unlinkSync(path.join(SNAPSHOT_DIR, f));
      }
    }
  });

  it("creates a snapshot and returns metadata", () => {
    const snap = createSnapshot(FIXTURE, "test-snap");
    expect(snap.repo).toBe(FIXTURE);
    expect(snap.label).toBe("test-snap");
    expect(snap.files.length).toBeGreaterThan(0);
    snapId = snap.snapshotId;
  });

  it("lists snapshots in desc time order", () => {
    const snap = createSnapshot(FIXTURE);
    const list = listSnapshots(FIXTURE);
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((item) => item.snapshotId === snap.snapshotId)).toBe(true);
    for (let i = 1; i < list.length; i++) {
      expect(new Date(list[i - 1].timestamp).getTime()).toBeGreaterThanOrEqual(new Date(list[i].timestamp).getTime());
    }
  });

  it("gets snapshot by id", () => {
    const snap = createSnapshot(FIXTURE);
    const fetched = getSnapshot(FIXTURE, snap.snapshotId);
    expect(fetched).not.toBeNull();
    expect(fetched!.snapshotId).toBe(snap.snapshotId);
  });

  it("restores snapshot after file change", () => {
    const snap = createSnapshot(FIXTURE, "before-change");
    const filePath = path.join(FIXTURE, "temp.txt");
    fs.writeFileSync(filePath, "changed", "utf-8");

    const restore = restoreSnapshot(FIXTURE, snap.snapshotId);
    expect(restore.restored).toBe(true);
    expect(restore.filesDeleted).toBe(1);

    // Cleanup
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });
});
