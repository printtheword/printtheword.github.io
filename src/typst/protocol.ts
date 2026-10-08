export interface WorkerRequest {
  id: number;
  source: string;
  /** font file URLs */
  fonts: string[];
  format: 'svg' | 'pdf';
  /** svg only: full document, when `source` is a shortened preview – used for the page count */
  countSource?: string;
}

export type WorkerResponse =
  | { id: number; ok: true; svg?: string; pages?: number; pdf?: Uint8Array }
  | { id: number; ok: false; error: string };
