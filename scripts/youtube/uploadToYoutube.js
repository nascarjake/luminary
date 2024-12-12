const fs = require('fs');
const { google } = require('googleapis');
const path = require('path');

// YouTube API configuration
const youtube = google.youtube('v3');

// Function to upload video to YouTube
async function uploadVideo(videoObject) {
    const { videoUrl, thumbnailUrl, title, description = '' } = videoObject;

    // Load client secrets from a local file.
    const credentials = JSON.parse(fs.readFileSync('./creds.json'));
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Automatically obtain and set the access token
    const getAccessToken = async () => {
        return new Promise((resolve, reject) => {
            const authUrl = oAuth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: ['https://www.googleapis.com/auth/youtube.upload']
            });

            const server = require('http').createServer(async (req, res) => {
                if (req.url.indexOf('/oauth2callback') > -1) {
                    const qs = new URL(req.url, 'http://localhost:3000').searchParams;
                    const code = qs.get('code');
                    res.end('Authentication successful! You can close this window.');
                    server.close();

                    try {
                        const { tokens } = await oAuth2Client.getToken(code);
                        oAuth2Client.setCredentials(tokens);
                        resolve(tokens.access_token);
                    } catch (err) {
                        reject(err);
                    }
                }
            }).listen(3000);

            require('open')(authUrl);
        });
    };

    const accessToken = await getAccessToken();
    oAuth2Client.setCredentials({ access_token: accessToken });

    // Upload video
    const fileSize = fs.statSync(videoUrl).size;
    const request = youtube.videos.insert({
        auth: oAuth2Client,
        part: 'snippet,status',
        notifySubscribers: false,
        requestBody: {
            snippet: {
                title,
                description,
                tags: ['tag1', 'tag2'], // Add your tags here
                categoryId: '22', // Category ID for People & Blogs
            },
            status: {
                privacyStatus: 'public', // or 'private' or 'unlisted'
            },
        },
        media: {
            body: fs.createReadStream(videoUrl),
        },
    }, {
        onUploadProgress: (evt) => {
            const progress = (evt.bytesRead / fileSize) * 100;
            console.log(`Upload progress: ${progress.toFixed(2)}%`);
        },
    });

    request.then(response => {
        console.log('Video uploaded successfully:', response.data);
        // Set thumbnail
        return uploadThumbnail(oAuth2Client, response.data.id, thumbnailUrl);
    }).then(() => {
        outputResult({ success: true, message: 'Upload completed successfully.' });
    }).catch(error => {
        console.error('Error during upload:', error);
        outputResult({ success: false, error: error.message });
    });
}

// Function to upload thumbnail
async function uploadThumbnail(auth, videoId, thumbnailUrl) {
    const request = youtube.thumbnails.set({
        auth,
        videoId,
        media: {
            body: fs.createReadStream(thumbnailUrl),
        },
    });

    return request.then(response => {
        console.log('Thumbnail uploaded successfully:', response.data);
    }).catch(error => {
        console.error('Error uploading thumbnail:', error);
        throw error; // Re-throw to handle in the main function
    });
}

// Function to output result
function outputResult(result) {
    console.log(JSON.stringify({ prefix: 'UPLOAD_RESULT', ...result }));
}

// Main function to handle input and process
async function main() {
    let inputData;
    try {
        inputData = JSON.parse(await new Promise(resolve => process.stdin.once('data', resolve)));
        await uploadVideo(inputData);
    } catch (error) {
        console.error('Error processing input:', error);
        outputResult({ success: false, error: error.message });
    }
}

// Execute the main function
main();