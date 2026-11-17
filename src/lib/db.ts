import { openDB, type IDBPDatabase } from 'idb';
import type { AnalysisRun, MappingState } from '../types';

const DB_NAME = 'campus-meal-dq';
const DB_VERSION = 1;

export interface SnapshotRecord {
  id: string;
  kind: 'INPUT_SNAPSHOT' | 'MAPPING_SNAPSHOT';
  payload: unknown;
  createdAt: string;
}

interface DBSchema {
  kv: { key: string; value: unknown };
  runs: { key: string; value: AnalysisRun };
  snapshots: { key: string; value: SnapshotRecord };
}

let dbPromise: Promise<IDBPDatabase<DBSchema>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<DBSchema>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('kv')) {
          database.createObjectStore('kv', { keyPath: 'key' });
        }
        if (!database.objectStoreNames.contains('runs')) {
          database.createObjectStore('runs', { keyPath: 'summary.runId' });
        }
        if (!database.objectStoreNames.contains('snapshots')) {
          database.createObjectStore('snapshots', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// ---------- KV（映射状态等单例对象） ----------

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const rec = await (await db()).get('kv', key);
  return rec ? (rec as { value: T }).value : undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await (await db()).put('kv', { key, value });
}

// ---------- 分析运行 ----------

export async function saveRun(run: AnalysisRun): Promise<void> {
  await (await db()).put('runs', run);
}

export async function getAllRuns(): Promise<AnalysisRun[]> {
  const runs = await (await db()).getAll('runs');
  return runs.sort((a, b) => b.summary.createdAt.localeCompare(a.summary.createdAt));
}

export async function getRun(runId: string): Promise<AnalysisRun | undefined> {
  return (await db()).get('runs', runId);
}

export async function deleteRun(runId: string): Promise<void> {
  await (await db()).delete('runs', runId);
}

// ---------- 快照 ----------

export async function saveSnapshot(rec: SnapshotRecord): Promise<void> {
  await (await db()).put('snapshots', rec);
}

export async function getAllSnapshots(): Promise<SnapshotRecord[]> {
  const recs = await (await db()).getAll('snapshots');
  return recs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function clearAll(): Promise<void> {
  const database = await db();
  await Promise.all([database.clear('kv'), database.clear('runs'), database.clear('snapshots')]);
}

export const KV_KEYS = {
  mappingState: 'mapping-state',
  lastDataset: 'last-dataset',
} as const;

export type { MappingState };
