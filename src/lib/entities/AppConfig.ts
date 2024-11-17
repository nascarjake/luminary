export interface AppConfig {
  version: string;
  profiles: Array<{
    id: string;
    name: string;
    default: boolean;
    openai: {
      apiKey: string;
    };
    threads: Array<{
      name: string;
      id: string;
      assistantId: string;
    }>;
  }>;
}
