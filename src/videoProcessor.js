export class VideoProcessor {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.isProcessing = false;
    }

    initialize(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    async extractFrame(video, time) {
        return new Promise((resolve) => {
            video.currentTime = time;
            video.addEventListener('seeked', () => {
                if (this.canvas && this.ctx) {
                    this.canvas.width = video.videoWidth;
                    this.canvas.height = video.videoHeight;
                    this.ctx.drawImage(video, 0, 0);
                    
                    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
                    resolve(imageData);
                }
            }, { once: true });
        });
    }

    preprocessFrame(imageData) {
        // Basic preprocessing for better detection
        const data = imageData.data;
        
        // Apply simple contrast enhancement
        for (let i = 0; i < data.length; i += 4) {
            // Enhance contrast
            data[i] = Math.min(255, data[i] * 1.1);     // Red
            data[i + 1] = Math.min(255, data[i + 1] * 1.1); // Green
            data[i + 2] = Math.min(255, data[i + 2] * 1.1); // Blue
        }
        
        return imageData;
    }

    extractColorHistogram(imageData, x, y, width, height) {
        const data = imageData.data;
        const canvasWidth = imageData.width;
        
        const histogram = {
            r: new Array(256).fill(0),
            g: new Array(256).fill(0),
            b: new Array(256).fill(0)
        };
        
        let pixelCount = 0;
        
        for (let py = y; py < y + height && py < imageData.height; py++) {
            for (let px = x; px < x + width && px < canvasWidth; px++) {
                const index = (py * canvasWidth + px) * 4;
                
                if (index < data.length) {
                    histogram.r[data[index]]++;
                    histogram.g[data[index + 1]]++;
                    histogram.b[data[index + 2]]++;
                    pixelCount++;
                }
            }
        }
        
        // Normalize histogram
        if (pixelCount > 0) {
            for (let i = 0; i < 256; i++) {
                histogram.r[i] /= pixelCount;
                histogram.g[i] /= pixelCount;
                histogram.b[i] /= pixelCount;
            }
        }
        
        return histogram;
    }

    getDominantColor(imageData, x, y, width, height) {
        const data = imageData.data;
        const canvasWidth = imageData.width;
        
        let r = 0, g = 0, b = 0;
        let pixelCount = 0;
        
        for (let py = y; py < y + height && py < imageData.height; py++) {
            for (let px = x; px < x + width && px < canvasWidth; px++) {
                const index = (py * canvasWidth + px) * 4;
                
                if (index < data.length) {
                    r += data[index];
                    g += data[index + 1];
                    b += data[index + 2];
                    pixelCount++;
                }
            }
        }
        
        if (pixelCount > 0) {
            return [
                Math.round(r / pixelCount),
                Math.round(g / pixelCount),
                Math.round(b / pixelCount)
            ];
        }
        
        return [0, 0, 0];
    }

    calculateOpticalFlow(prevFrame, currentFrame) {
        // Simplified optical flow calculation
        // In a real implementation, you would use Lucas-Kanade or similar algorithms
        
        const flow = [];
        const blockSize = 16;
        const searchRange = 8;
        
        for (let y = 0; y < currentFrame.height - blockSize; y += blockSize) {
            for (let x = 0; x < currentFrame.width - blockSize; x += blockSize) {
                const motion = this.findBestMatch(
                    prevFrame, currentFrame, 
                    x, y, blockSize, searchRange
                );
                
                flow.push({
                    x: x + blockSize / 2,
                    y: y + blockSize / 2,
                    dx: motion.dx,
                    dy: motion.dy,
                    confidence: motion.confidence
                });
            }
        }
        
        return flow;
    }

    findBestMatch(prevFrame, currentFrame, x, y, blockSize, searchRange) {
        let bestDx = 0, bestDy = 0;
        let bestError = Infinity;
        
        for (let dy = -searchRange; dy <= searchRange; dy++) {
            for (let dx = -searchRange; dx <= searchRange; dx++) {
                const error = this.calculateBlockError(
                    prevFrame, currentFrame,
                    x, y, x + dx, y + dy, blockSize
                );
                
                if (error < bestError) {
                    bestError = error;
                    bestDx = dx;
                    bestDy = dy;
                }
            }
        }
        
        return {
            dx: bestDx,
            dy: bestDy,
            confidence: 1 / (1 + bestError / 1000)
        };
    }

    calculateBlockError(frame1, frame2, x1, y1, x2, y2, blockSize) {
        let error = 0;
        let pixelCount = 0;
        
        for (let dy = 0; dy < blockSize; dy++) {
            for (let dx = 0; dx < blockSize; dx++) {
                const px1 = x1 + dx;
                const py1 = y1 + dy;
                const px2 = x2 + dx;
                const py2 = y2 + dy;
                
                if (px1 >= 0 && py1 >= 0 && px1 < frame1.width && py1 < frame1.height &&
                    px2 >= 0 && py2 >= 0 && px2 < frame2.width && py2 < frame2.height) {
                    
                    const idx1 = (py1 * frame1.width + px1) * 4;
                    const idx2 = (py2 * frame2.width + px2) * 4;
                    
                    // Calculate grayscale difference
                    const gray1 = (frame1.data[idx1] + frame1.data[idx1 + 1] + frame1.data[idx1 + 2]) / 3;
                    const gray2 = (frame2.data[idx2] + frame2.data[idx2 + 1] + frame2.data[idx2 + 2]) / 3;
                    
                    error += Math.abs(gray1 - gray2);
                    pixelCount++;
                }
            }
        }
        
        return pixelCount > 0 ? error / pixelCount : Infinity;
    }

    applyGaussianBlur(imageData, radius = 1) {
        const data = new Uint8ClampedArray(imageData.data);
        const width = imageData.width;
        const height = imageData.height;
        
        // Simple box blur approximation of Gaussian blur
        for (let channel = 0; channel < 3; channel++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let sum = 0;
                    let count = 0;
                    
                    for (let dy = -radius; dy <= radius; dy++) {
                        for (let dx = -radius; dx <= radius; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;
                            
                            if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
                                const idx = (ny * width + nx) * 4 + channel;
                                sum += data[idx];
                                count++;
                            }
                        }
                    }
                    
                    const idx = (y * width + x) * 4 + channel;
                    imageData.data[idx] = sum / count;
                }
            }
        }
        
        return imageData;
    }
}