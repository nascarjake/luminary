export type OAAsistant = {
  id: string;
  object: 'assitant',
  created_at: number;
  name: string;
  description?: string;
  model: string;
  instructions: string;
  tools: {
    type: string;
  }[];
  file_ids: string[];
  metadata: Record<string, unknown>;
};
