export type OAThreadMessage = {
  id: string;
  thread_id: string;
  run_id: string;
  assistant_id: string;
  file_ids: string[];
  role: 'assistant';
  object: 'thread.message',
  created_at: number;
  content: {
    type: 'text';
    text: {
      value: string;
      annotations: string[];
    };
  }[];
  metadata: Record<string, unknown>;
};
