const fs = require('fs');
const { google } = require('googleapis');
const path = require('path');

// YouTube API configuration with service account
const auth = new google.auth.GoogleAuth({
    keyFile: './creds.json',
    scopes: ['https://www.googleapis.com/auth/youtube.upload']
});

const youtube = google.youtube('v3');

// Function to upload video to YouTube
async function uploadVideo(videoObject) {
    const { videoUrl, thumbnailUrl, title, description = '' } = videoObject;

    try {
        // Get authenticated client
        const authClient = await auth.getClient();

        // Upload video
        const fileSize = fs.statSync(videoUrl).size;
        console.log('Starting video upload...');
        
        const response = await youtube.videos.insert({
            auth: authClient,
            part: 'snippet,status',
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
                body: fs.createReadStream(videoUrl),
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
            await uploadThumbnail(authClient, response.data.id, thumbnailUrl);
        }

        return response.data;
    } catch (error) {
        console.error('Error uploading video:', error);
        throw error;
    }
}

// Function to upload thumbnail
async function uploadThumbnail(auth, videoId, thumbnailUrl) {
    try {
        console.log('Uploading thumbnail...');
        const response = await youtube.thumbnails.set({
            auth,
            videoId,
            media: {
                body: fs.createReadStream(thumbnailUrl),
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
        inputData = JSON.parse(rawInput.toString());
        
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