#!/usr/bin/env node

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
//import PictoryClient from './client.js';
import dotenv from 'dotenv';
import { input } from '@angular/core';

dotenv.config();

class PictoryClient {
  constructor(config) {
    this.config = config;
    this.authToken = null;
    //console.log('Pictory API URL:', config.apiUrl);
    this.http = axios.create({
      baseURL: config.apiUrl
    });
  }

  async getAuthToken() {
    if (this.authToken) return this.authToken;
    
    try {
      const response = await this.http.post('/oauth2/token', {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      });

      this.authToken = response.data.access_token;
      return this.authToken;
    } catch (error) {
      throw new Error(`Failed to authenticate with Pictory: ${error.message}`);
    }
  }

  async createStoryboard(content) {
    // Get fresh token
    this.authToken = null;
    const authToken = await this.getAuthToken();
    
    // Clean up content
    if (content.webhook !== undefined) delete content.webhook;
    if (content.videoDescription) content.videoDescription = content.videoDescription.substring(0, 100);
    if (content.brandLogo) content.brandLogo.url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Test-Logo.svg/2560px-Test-Logo.svg.png';

    try {
      console.log('📤 Creating storyboard with Pictory API');
      const response = await this.http.post('/video/storyboard', content, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Pictory-User-Id': this.config.userId
        }
      });

      if (!response.data.success) {
        throw new Error('Failed to create storyboard');
      }

      //console.log('✅ Pictory API request successful, job ID:', response.data.jobId);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create storyboard: ${error.message}`);
    }
  }

  async checkJobStatus(jobId) {
    const authToken = await this.getAuthToken();
    
    try {
      const response = await this.http.get(`/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Pictory-User-Id': this.config.userId
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to check job status: ${error.message}`);
    }
  }

  async pollJobUntilComplete(jobId) {
    console.log('⏳ Waiting for video job to complete...');
    while (true) {
      const status = await this.checkJobStatus(jobId);
      
      if (!status.success) {
        if (status.data?.error_message) {
          const error = status.data.error_message;
          throw new Error(`Pictory Error: ${error.message || error.error_code || JSON.stringify(status) || 'Unknown error'}`);
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

  async renderVideo(renderParams) {
    const authToken = await this.getAuthToken();
    
    try {
      console.log('🎬 Starting video render...');
      const response = await this.http.post('/video/render', renderParams, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Pictory-User-Id': this.config.userId
        }
      });

      if (!response.data.success) {
        throw new Error('Failed to start video render');
      }

      return this.pollJobUntilComplete(response.data.data.job_id);
    } catch (error) {
      throw new Error(`Failed to render video: ${error.message}`);
    }
  }

  async downloadVideo(url, outputDir, name) {
    try {
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream'
      });

      const ext = path.extname(url) || '.mp4';
      const filename = `${name}${ext}`;
      const filepath = path.join(outputDir, filename);
      
      await fs.mkdir(outputDir, { recursive: true });
      const writer = fs.createWriteStream(filepath);
      
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log('✨ Video generated and saved to:', filepath);
          resolve(filepath);
        });
        writer.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Failed to download video: ${error.message}`);
    }
  }
}

async function main() {
  let inputData = undefined;
  let content = undefined;
  try{
    inputData = JSON.parse(await new Promise(resolve => process.stdin.once('data', resolve)));
  }catch(e){
    // Return error response
    console.error('❌ Error:', error.message);
    const result = {
      success: false,
      error: error.message
    };
    
    console.log(JSON.stringify({inputData}));
    process.exit(1);
  }

  try {
    // Get all inputs as a single JSON object with defaults
    content = inputData?.content;
    if(!content && inputData?.videoName) content = inputData;

    const { videoName: title } = content;
    console.log('🚀 Starting video generation: ' + title);

    // Load config from environment
    const config = {
      apiUrl: process.env.PICTORY_API_URL,
      clientId: process.env.PICTORY_CLIENT_ID,
      clientSecret: process.env.PICTORY_CLIENT_SECRET,
      userId: process.env.PICTORY_USER_ID
    };

    // Initialize client
    const client = new PictoryClient(config);
    
    // Create storyboard
    const storyboard = await client.createStoryboard(content);
    console.log(`🎥 Video generation started. Job ID: ${storyboard.jobId}`);
    
    // Wait for storyboard completion
    const jobStatus = await client.pollJobUntilComplete(storyboard.jobId);
    
    if (!jobStatus.data.renderParams) {
      throw new Error('No render parameters received');
    }
    
    // Start video render
    const renderStatus = await client.renderVideo(jobStatus.data.renderParams);
    
    if (!renderStatus.data.videoURL) {
      throw new Error('No video URL received');
    }
    
    // Download video
    const videoName = title || `video-${renderStatus.job_id}`;
    
    // Return success response
    const result = {
      /*videoPath,*/
      title: videoName,
      videoUrl: renderStatus.data.videoURL,
      thumbnail: renderStatus.data.thumbnail,
      duration: renderStatus.data.videoDuration
    };
    
    console.log('✨ Video generation complete!');
    console.log('$%*%$Output:' + JSON.stringify({video: result, pictoryRequest: content, pictoryRender: renderStatus, pictoryJob: jobStatus}));
  } catch (error) {
    // Return error response
    console.error('❌ Error:', error.message);
    const result = {
      success: false,
      error: error.message
    };
    
    console.log('$%*%$Output:' + JSON.stringify({pictoryRequest: content}));
    process.exit(1);
  }
}

main();
