import { PlayerTracker } from './playerTracker.js';
import { VideoProcessor } from './videoProcessor.js';
import { UIController } from './uiController.js';

class PlayerReidentificationApp {
    constructor() {
        this.videoProcessor = new VideoProcessor();
        this.playerTracker = new PlayerTracker();
        this.uiController = new UIController();
        
        this.isProcessing = false;
        this.currentVideo = null;
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const videoInput = document.getElementById('videoInput');
        const processBtn = document.getElementById('processBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const resetBtn = document.getElementById('resetBtn');

        videoInput.addEventListener('change', (e) => this.handleVideoUpload(e));
        processBtn.addEventListener('click', () => this.startProcessing());
        pauseBtn.addEventListener('click', () => this.pauseProcessing());
        resetBtn.addEventListener('click', () => this.resetProcessing());
    }

    async handleVideoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('video/')) {
            alert('Please select a valid video file');
            return;
        }

        this.currentVideo = file;
        const videoPlayer = document.getElementById('videoPlayer');
        const videoUrl = URL.createObjectURL(file);
        
        videoPlayer.src = videoUrl;
        
        // Show processing section
        document.getElementById('processingSection').style.display = 'block';
        
        // Initialize canvas
        const canvas = document.getElementById('outputCanvas');
        const ctx = canvas.getContext('2d');
        
        videoPlayer.addEventListener('loadedmetadata', () => {
            canvas.width = videoPlayer.videoWidth;
            canvas.height = videoPlayer.videoHeight;
            
            // Draw initial frame
            ctx.drawImage(videoPlayer, 0, 0, canvas.width, canvas.height);
        });

        this.uiController.updateProgress(0, 'Video loaded successfully');
    }

    async startProcessing() {
        if (!this.currentVideo || this.isProcessing) return;

        this.isProcessing = true;
        const processBtn = document.getElementById('processBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        
        processBtn.disabled = true;
        pauseBtn.disabled = false;
        
        try {
            await this.processVideo();
        } catch (error) {
            console.error('Processing error:', error);
            this.uiController.updateProgress(0, 'Processing failed');
        } finally {
            this.isProcessing = false;
            processBtn.disabled = false;
            pauseBtn.disabled = true;
        }
    }

    async processVideo() {
        const videoPlayer = document.getElementById('videoPlayer');
        const canvas = document.getElementById('outputCanvas');
        const ctx = canvas.getContext('2d');
        
        // Reset tracking state
        this.playerTracker.reset();
        
        // Show results section
        document.getElementById('resultsSection').style.display = 'block';
        
        const duration = videoPlayer.duration;
        const fps = 30; // Assume 30 FPS
        const totalFrames = Math.floor(duration * fps);
        let currentFrame = 0;
        
        const processFrame = async () => {
            if (!this.isProcessing) return;
            
            const currentTime = currentFrame / fps;
            videoPlayer.currentTime = currentTime;
            
            // Wait for video to seek
            await new Promise(resolve => {
                const onSeeked = () => {
                    videoPlayer.removeEventListener('seeked', onSeeked);
                    resolve();
                };
                videoPlayer.addEventListener('seeked', onSeeked);
            });
            
            // Draw current frame
            ctx.drawImage(videoPlayer, 0, 0, canvas.width, canvas.height);
            
            // Get image data for processing
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Simulate player detection (in real implementation, this would use YOLOv11)
            const detections = this.simulatePlayerDetection(currentFrame, canvas.width, canvas.height);
            
            // Update player tracking
            const trackedPlayers = this.playerTracker.updateTracking(detections, currentTime);
            
            // Draw tracking results
            this.drawTrackingResults(ctx, trackedPlayers);
            
            // Update UI
            const progress = (currentFrame / totalFrames) * 100;
            this.uiController.updateProgress(progress, `Processing frame ${currentFrame}/${totalFrames}`);
            this.uiController.updateStats(this.playerTracker.getStats());
            this.uiController.updatePlayerHistory(this.playerTracker.getPlayerHistory());
            
            currentFrame++;
            
            if (currentFrame < totalFrames && this.isProcessing) {
                // Process next frame with small delay to show progress
                setTimeout(processFrame, 50);
            } else {
                this.uiController.updateProgress(100, 'Processing complete');
            }
        };
        
        processFrame();
    }

    simulatePlayerDetection(frameNumber, width, height) {
        // Simulate realistic player movement patterns
        const detections = [];
        const numPlayers = 6 + Math.floor(Math.random() * 4); // 6-10 players
        
        for (let i = 0; i < numPlayers; i++) {
            // Simulate players moving across the field
            const baseX = (i * width / numPlayers) + (frameNumber * 2) % width;
            const baseY = height * 0.3 + Math.sin(frameNumber * 0.1 + i) * height * 0.4;
            
            // Add some randomness
            const x = Math.max(0, Math.min(width - 50, baseX + (Math.random() - 0.5) * 20));
            const y = Math.max(0, Math.min(height - 80, baseY + (Math.random() - 0.5) * 20));
            
            // Simulate some players going out of frame occasionally
            const isVisible = Math.random() > 0.1; // 90% chance of being visible
            
            if (isVisible) {
                detections.push({
                    x: x,
                    y: y,
                    width: 40 + Math.random() * 20,
                    height: 60 + Math.random() * 20,
                    confidence: 0.7 + Math.random() * 0.3,
                    features: this.extractSimulatedFeatures(x, y, i)
                });
            }
        }
        
        return detections;
    }

    extractSimulatedFeatures(x, y, playerId) {
        // Simulate color and shape features for each player
        const colors = [
            [255, 0, 0],    // Red
            [0, 255, 0],    // Green
            [0, 0, 255],    // Blue
            [255, 255, 0],  // Yellow
            [255, 0, 255],  // Magenta
            [0, 255, 255],  // Cyan
            [255, 128, 0],  // Orange
            [128, 0, 255],  // Purple
            [255, 192, 203], // Pink
            [165, 42, 42]   // Brown
        ];
        
        const playerColor = colors[playerId % colors.length];
        
        return {
            dominantColor: playerColor,
            position: [x, y],
            size: Math.random() * 0.5 + 0.75, // Size variation
            aspectRatio: 0.6 + Math.random() * 0.2
        };
    }

    drawTrackingResults(ctx, trackedPlayers) {
        trackedPlayers.forEach(player => {
            const { id, bbox, confidence, status } = player;
            
            // Choose color based on player ID
            const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
            const color = colors[id % colors.length];
            
            // Draw bounding box
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);
            
            // Draw player ID
            ctx.fillStyle = color;
            ctx.font = 'bold 16px Arial';
            ctx.fillRect(bbox.x, bbox.y - 25, 60, 25);
            ctx.fillStyle = 'white';
            ctx.fillText(`P${id}`, bbox.x + 5, bbox.y - 8);
            
            // Draw confidence
            ctx.fillStyle = color;
            ctx.font = '12px Arial';
            ctx.fillText(`${(confidence * 100).toFixed(0)}%`, bbox.x + bbox.width - 35, bbox.y - 8);
            
            // Draw status indicator
            if (status === 'reidentified') {
                ctx.fillStyle = '#27AE60';
                ctx.beginPath();
                ctx.arc(bbox.x + bbox.width - 10, bbox.y + 10, 5, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    }

    pauseProcessing() {
        this.isProcessing = false;
        document.getElementById('processBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
    }

    resetProcessing() {
        this.isProcessing = false;
        this.playerTracker.reset();
        
        // Reset UI
        document.getElementById('processBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('resultsSection').style.display = 'none';
        
        this.uiController.updateProgress(0, 'Ready to process');
        
        // Clear canvas
        const canvas = document.getElementById('outputCanvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new PlayerReidentificationApp();
});