import type { WorkerRequest, WorkerResponse } from './protocol.ts';
import TypstWorker from './worker.ts?worker';

let worker: Worker | undefined;
let nextId = 1;
const pending = new Map<number, { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new TypstWorker();
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const p = pending.get(e.data.id);
      pending.delete(e.data.id);
      p?.resolve(e.data);
    };
    worker.onerror = (e) => {
      for (const p of pending.values()) p.reject(new Error(e.message || 'Typst-Worker abgestürzt'));
      pending.clear();
      worker?.terminate();
      worker = undefined;
    };
  }
  return worker;
}

/** Compiles Typst source in the background worker. Requests are processed in order. */
export function compile(req: Omit<WorkerRequest, 'id'>): Promise<WorkerResponse> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ ...req, id });
  });
}
