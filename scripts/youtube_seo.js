#!/usr/bin/env node

import axios from 'axios';
import dotenv from 'dotenv';
import natural from 'natural';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Emotional triggers for engaging content
const EMOTIONAL_TRIGGERS = [
  "Amazing", "Incredible", "Unbelievable", "Mind-blowing", "Secrets", "Revealed",
  "Untold", "Discover", "Now", "Instant", "Hurry", "Quick", "Insider", "Exclusive",
  "Limited", "VIP", "Proven", "Guaranteed", "Reliable", "Authentic"
];

class YoutubeSEOGenerator {
  constructor(config) {
    this.config = config;
    this.tokenizer = new natural.WordTokenizer();
    this.http = axios.create({
      baseURL: 'https://www.googleapis.com/youtube/v3'
    });
  }

  async getTopVideos(query, maxResults = 50) {
    try {
      console.log('🔍 Fetching top videos for research...');
      const response = await this.http.get('/search', {
        params: {
          part: 'snippet',
          q: query,
          type: 'video',
          maxResults,
          key: this.config.apiKey
        }
      });

      return response.data.items || [];
    } catch (error) {
      console.error('❌ Error fetching videos:', error.message);
      return [];
    }
  }

  generateTitle(keyword) {
    console.log('📝 Generating engaging title...');
    const titleStructure = [
      this._getRandomElement(EMOTIONAL_TRIGGERS),
      keyword.charAt(0).toUpperCase() + keyword.slice(1),
      this._getRandomElement(["Secrets", "Adventures", "Discoveries", "Explorations"]),
      `(${this._getRandomElement(EMOTIONAL_TRIGGERS)} Tips)`
    ];
    
    return titleStructure.join(' ').slice(0, 70).trim();
  }

  generateDescription(keyword) {
    console.log('📄 Creating comprehensive description...');
    const sections = [
      `${this._getRandomElement(EMOTIONAL_TRIGGERS)}! ${this._getRandomElement(EMOTIONAL_TRIGGERS)} guide to ${keyword}! 🚀`,
      `Embark on an extraordinary journey into the world of ${keyword}. Discover hidden gems, expert insights, and breathtaking experiences that will leave you in awe.`,
      `🔔 ${this._getRandomElement(EMOTIONAL_TRIGGERS)}! SUBSCRIBE now for ${this._getRandomElement(EMOTIONAL_TRIGGERS)} ${keyword} content!`,
      `👇 Share your ${this._getRandomElement(EMOTIONAL_TRIGGERS)} thoughts! What's your experience with ${keyword}?`,
      `Don't miss out on our upcoming videos about ${keyword} and related topics. Stay tuned for more ${this._getRandomElement(EMOTIONAL_TRIGGERS)} content!`
    ];

    return sections.join('\n\n').slice(0, 2000).trim();
  }

  generateTags(keyword) {
    console.log('🏷️ Generating relevant tags...');
    const baseWords = this.tokenizer.tokenize(keyword);
    const relatedTerms = [
      "adventure", "exploration", "discovery", "travel", "experience",
      "guide", "tips", "secrets", "hidden", "amazing", "breathtaking",
      "unforgettable", "journey", "expedition", "ultimate"
    ];

    let tags = [keyword, ...baseWords, ...relatedTerms];
    tags.push(...relatedTerms.map(term => `${keyword} ${term}`));
    tags.push(...relatedTerms.map(term => `${term} ${keyword}`));

    // Remove duplicates and limit to 30 tags
    return [...new Set(tags)].slice(0, 30);
  }

  generateHashtags(tags, keyword) {
    console.log('# Creating hashtags...');
    const hashtags = tags
      .slice(0, 14)
      .filter(tag => tag.length > 2)
      .map(tag => `#${tag.replace(/\s+/g, '')}`);

    const keywordHashtag = `#${keyword.replace(/\s+/g, '')}`;
    if (!hashtags.includes(keywordHashtag)) {
      hashtags.unshift(keywordHashtag);
    }

    return [...new Set(hashtags)].slice(0, 15);
  }

  calculateSEOScore(title, description, tags, hashtags) {
    console.log('📊 Calculating SEO score...');
    let score = 0;

    // Title optimization (20 points)
    if (title.length <= 70) score += 20;

    // Description optimization (30 points)
    if (description.length >= 500 && description.length <= 2000) score += 30;

    // Tags optimization (30 points)
    score += Math.min(tags.length, 30);

    // Hashtags optimization (20 points)
    score += Math.min(hashtags.length * 2, 20);

    return Math.min(score, 100);
  }

  getMockAnalytics() {
    return {
      views: this._getRandomInt(10000, 1000000),
      likes: this._getRandomInt(1000, 100000),
      comments: this._getRandomInt(100, 10000),
      shareability: this._getRandomInt(70, 100)
    };
  }

  _getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  _getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

async function main() {
  try {
    // Get input from stdin
    const input = await new Promise(resolve => {
      let data = '';
      process.stdin.on('data', chunk => data += chunk);
      process.stdin.on('end', () => resolve(data));
    });

    // Parse input JSON
    const { keyword, apiKey } = JSON.parse(input);

    if (!keyword) {
      throw new Error('Keyword is required');
    }

    // Initialize SEO generator
    const generator = new YoutubeSEOGenerator({
      apiKey: apiKey || process.env.YOUTUBE_API_KEY
    });

    // Generate SEO content
    console.log('🎬 Starting YouTube SEO generation process...');
    const title = generator.generateTitle(keyword);
    const description = generator.generateDescription(keyword);
    const tags = generator.generateTags(keyword);
    const hashtags = generator.generateHashtags(tags, keyword);
    const seoScore = generator.calculateSEOScore(title, description, tags, hashtags);
    const analytics = generator.getMockAnalytics();

    // Prepare output
    const result = {
      success: true,
      data: {
        keyword,
        title,
        description,
        tags,
        hashtags,
        seoScore,
        analytics,
        timestamp: new Date().toISOString()
      }
    };

    // Output result in the required format
    console.log('$%*%$Output:' + JSON.stringify(result));
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message
    }));
    process.exit(1);
  }
}

main();
