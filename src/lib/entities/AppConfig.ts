export interface Project {
  id: string;
  name: string;
  description?: string;
  created: string;
  lastModified: string;
}

export interface Profile {
  id: string;
  name: string;
  description?: string;
  default: boolean;
  openai: {
    apiKey: string;
  };
  threads: Array<{
    name: string;
    id: string;
    assistantId: string;
  }>;
  projects: Project[];
  activeProjectId?: string;
}

export interface AppConfig {
  version: string;
  profiles: Profile[];
}
