import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface PictoryAuth {
  access_token: string;
  expires_in: number;
  token_type: string;
  expiration_time?: number;
}

export interface PictoryJobResponse {
  jobId: string;
  success: boolean;
  data: {
    job_id: string;
  };
}

export interface PictoryJobStatus {
  job_id: string;
  success: boolean;
  data: {
    status?: string;
    renderParams?: {
      audio: any;
      output: any;
      scenes: any[];
      next_generation_video: boolean;
      containsTextToImage: boolean;
    };
    error_code: string;
    error_message: {
      error_code: string;
      message: string;
      scene: number;
      error_type: string;
    }
    preview?: string;
    txtFile?: string;
    audioURL?: string;
    thumbnail?: string;
    videoDuration?: number;
    videoURL?: string;
    vttFile?: string;
    srtFile?: string;
    shareVideoURL?: string;
  };
}

export interface PictoryRequest {
  jobId: string;
  content: any;
  title: string;
  threadId: string;
  preview: string;
}

export interface PictoryRender {
  jobId: string;
  preview: string;
  video: string;
  thumbnail: string;
  duration: number;
}

export interface Video {
  name: string;
  file: string;
  url: string;
  thumbnail: string;
}

export class PictoryUtils {
  private authToken: string | null = null;

  constructor(private http: HttpClient) {}

  private async getAuthToken(): Promise<string> {
    if (this.authToken) {
      return this.authToken;
    }
    
    try {
      const response = await this.http.post<PictoryAuth>(
        `${environment.pictory.apiUrl}/oauth2/token`,
        {
          client_id: environment.pictory.clientId,
          client_secret: environment.pictory.clientSecret
        }
      ).toPromise();

      if (!response) {
        throw new Error('Failed to get Pictory auth token');
      }

      this.authToken = response.access_token;
      return this.authToken;
    } catch (error) {
      console.error('Error getting Pictory auth token:', error);
      throw new Error('Failed to authenticate with Pictory');
    }
  }

  async createStoryboard(content: any): Promise<PictoryJobResponse> {
    // Get fresh token at start of new video generation
    this.authToken = null;
    const authToken = await this.getAuthToken();
    const headers = new HttpHeaders({
      'accept': 'application/json',
      'content-type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'X-Pictory-User-Id': environment.pictory.userId
    });

    // Clean up content
    if (content.webhook !== undefined) delete content.webhook;
    if (content.videoDescription) content.videoDescription = content.videoDescription.substring(0, 100);
    if (content.brandLogo) content.brandLogo.url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Test-Logo.svg/2560px-Test-Logo.svg.png';

    const response = await this.http.post<PictoryJobResponse>(
      environment.pictory.apiUrl + '/video/storyboard',
      content,
      { headers }
    ).toPromise();

    if (!response || !response.success) {
      throw new Error('Failed to create storyboard');
    }

    return response;
  }

  async checkJobStatus(jobId: string): Promise<PictoryJobStatus> {
    const authToken = await this.getAuthToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${authToken}`,
      'X-Pictory-User-Id': environment.pictory.userId,
      'Content-Type': 'application/json'
    });

    const response = await this.http.get<PictoryJobStatus>(
      `${environment.pictory.apiUrl}/jobs/${jobId}`,
      { headers }
    ).toPromise();

    if (!response) {
      throw new Error('Failed to get job status');
    }

    return response;
  }

  async pollJobUntilComplete(jobId: string): Promise<PictoryJobStatus> {
    while (true) {
      const status = await this.checkJobStatus(jobId);
      
      if (!status.success) {
        // Handle Pictory error response
        if (status.data?.error_message) {
          const error = status.data.error_message;
          throw new Error(`Pictory Error: ${error.message || error.error_code || 'Unknown error'}`);
        }
        throw new Error('Failed to get job status');
      }
      
      if (status.data.status === 'completed' || status.data.renderParams) {
        return status;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  async renderVideo(renderParams: any): Promise<PictoryJobStatus> {
    const authToken = await this.getAuthToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${authToken}`,
      'X-Pictory-User-Id': environment.pictory.userId,
      'Content-Type': 'application/json'
    });

    const response = await this.http.post<PictoryJobResponse>(
      `${environment.pictory.apiUrl}/video/render`,
      renderParams,
      { headers }
    ).toPromise();

    if (!response || !response.success) {
      throw new Error('Failed to start video render');
    }

    // Poll until render is complete
    return this.pollJobUntilComplete(response.data.job_id);
  }

  async downloadVideo(url: string, name: string): Promise<string> {
    console.log('📥 Downloading video:', { url, name });
    try {
      // Get app config directory
      const configDir = await window.electron.path.appConfigDir();
      const videoDir = await window.electron.path.join(configDir, 'videos');
      
      // Create videos directory if it doesn't exist
      await window.electron.fs.createDir(videoDir, { recursive: true });
      
      // Create file path
      const filePath = await window.electron.path.join(videoDir, `${name}.mp4`);
      
      // Check if file already exists
      const exists = await window.electron.fs.exists(filePath);
      if (exists) {
        console.log('🎥 Video already exists:', filePath);
        return filePath;
      }
      
      // Download the file using Electron's main process
      await window.electron.download.downloadFile(url, filePath);

      return filePath;
    } catch (error) {
      console.error('Error downloading video:', error);
      throw new Error('Failed to download video');
    }
  }
}
