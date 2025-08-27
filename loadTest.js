const { exec } = require('child_process');
const path = require('path');

// Change this to match your file name
const inputVideo = "ALPS & DOLOMITES (Drone + Timelapse) Heavenly Nature Relaxation™ 5 Minute Short Film in 4K UHD.mp4";

function transcodeVideo(fileNumber, resolution) {
  return new Promise((resolve, reject) => {
    const outputFile = `output${fileNumber}.mp4`;

    // ffmpeg command to transcode video to a specific resolution
    exec(
      `ffmpeg -y -i "${inputVideo}" -vf scale=${resolution} -c:v libx264 -preset fast -crf 23 ${outputFile}`,
      (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`✅ Transcoding completed: ${outputFile}`);
          resolve();
        }
      }
    );
  });
}

async function runLoad() {
  const promises = [];

  // Run 2 parallel transcoding tasks to push CPU usage
  promises.push(transcodeVideo(0, "1280:720"));  // HD
  promises.push(transcodeVideo(1, "640:360"));   // Lower resolution

  await Promise.all(promises);
  console.log('🎥 Load test completed!');
}

runLoad().catch((err) => console.error('Error during load test:', err));
