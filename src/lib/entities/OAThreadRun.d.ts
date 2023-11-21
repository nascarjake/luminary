export type OAThreadRun = {
  id: string;
  object: 'thread.run';
  created_at: number;
  assistant_id: string;
  thread_id: string;
  status: 'queued'|'in_progress'|'requires_action'|'cancelling'|'cancelled'|'failed'|'completed'|'expired';
  started_at: number;
  expires_at: number;
  cancelled_at: number;
  failed_at: number;
  completed_at: number;
  last_error: any;
  model: string;
  instructions: string;
  tools: {
    type: string;
  }[];
  file_ids: string[];
  metadata: Record<string, unknown>;
}
