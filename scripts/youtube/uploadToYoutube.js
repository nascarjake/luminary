const fs = require('fs');
const { google } = require('googleapis');
const path = require('path');

// YouTube API configuration with service account
const auth = new google.auth.GoogleAuth({
    keyFilename: path.join(__dirname, 'creds.json'),
    scopes: ['https://www.googleapis.com/auth/youtube.upload']
});

// Create YouTube client
const youtube = google.youtube({ version: 'v3', auth });

// Function to validate file path
function validateFilePath(filePath) {
    if (!filePath) {
        throw new Error('File path is required');
    }
    
    // Convert to absolute path if relative
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
    }
    
    return absolutePath;
}

// Function to upload video to YouTube
async function uploadVideo(videoObject) {
    const { videoUrl, thumbnailUrl, title, description = '' } = videoObject;

    try {
        console.log('Validating video path:', videoUrl);
        const absoluteVideoPath = validateFilePath(videoUrl);
        console.log('Using video path:', absoluteVideoPath);

        // Get authenticated client
        const authClient = await auth.getClient();

        // Upload video
        const fileSize = fs.statSync(absoluteVideoPath).size;
        console.log('Starting video upload...');
        console.log('File size:', fileSize, 'bytes');
        
        const response = await youtube.videos.insert({
            auth: authClient,
            part: ['snippet', 'status'],
            notifySubscribers: false,
            requestBody: {
                snippet: {
                    title,
                    description,
                    tags: ['tag1', 'tag2'],
                    categoryId: '22', // Category ID for People & Blogs
                },
                status: {
                    privacyStatus: 'public',
                },
            },
            media: {
                body: fs.createReadStream(absoluteVideoPath),
            },
        }, {
            onUploadProgress: evt => {
                const progress = (evt.bytesRead / fileSize) * 100;
                console.log(`Upload progress: ${progress.toFixed(2)}%`);
            },
        });

        console.log('Video uploaded successfully:', response.data);

        // Upload thumbnail if provided
        if (thumbnailUrl) {
            console.log('Validating thumbnail path:', thumbnailUrl);
            const absoluteThumbnailPath = validateFilePath(thumbnailUrl);
            await uploadThumbnail(response.data.id, absoluteThumbnailPath);
        }

        return response.data;
    } catch (error) {
        console.error('Error uploading video:', error);
        throw error;
    }
}

// Function to upload thumbnail
async function uploadThumbnail(videoId, thumbnailPath) {
    try {
        console.log('Uploading thumbnail...');
        const response = await youtube.thumbnails.set({
            auth: await auth.getClient(),
            videoId,
            media: {
                body: fs.createReadStream(thumbnailPath),
            },
        });
        console.log('Thumbnail uploaded successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error uploading thumbnail:', error);
        throw error;
    }
}

// Function to output result
function outputResult(result) {
    console.log(JSON.stringify({ prefix: 'UPLOAD_RESULT', ...result }));
}

// Main function to handle input and process
async function main() {
    let inputData;
    try {
        const rawInput = await new Promise(resolve => process.stdin.once('data', resolve));
        inputData = JSON.parse(rawInput);
        console.log('🚀 Uploading video: ', inputData.title);
        
        const result = await uploadVideo(inputData);
        outputResult({ 
            success: true, 
            videoId: result.id,
            url: `https://www.youtube.com/watch?v=${result.id}`
        });
    } catch (error) {
        console.error('Error processing input:', error);
        outputResult({ 
            success: false, 
            error: error.message 
        });
    }
}

// Execute the main function
main();