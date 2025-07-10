export class PlayerTracker {
    constructor() {
        this.players = new Map(); // Active players
        this.nextPlayerId = 1;
        this.playerHistory = [];
        this.maxDistance = 100; // Maximum distance for tracking
        this.reidentificationThreshold = 0.7;
        this.framesSinceLastSeen = new Map();
        this.maxFramesBeforeRemoval = 30; // Remove player after 30 frames
    }

    reset() {
        this.players.clear();
        this.nextPlayerId = 1;
        this.playerHistory = [];
        this.framesSinceLastSeen.clear();
    }

    updateTracking(detections, currentTime) {
        const trackedPlayers = [];
        const usedDetections = new Set();

        // Update existing players
        for (const [playerId, player] of this.players) {
            let bestMatch = null;
            let bestDistance = Infinity;
            let bestDetectionIndex = -1;

            // Find best matching detection
            detections.forEach((detection, index) => {
                if (usedDetections.has(index)) return;

                const distance = this.calculateDistance(player.lastPosition, [detection.x, detection.y]);
                const featureSimilarity = this.calculateFeatureSimilarity(player.features, detection.features);
                
                // Combined score: distance and feature similarity
                const score = distance * 0.6 + (1 - featureSimilarity) * 100 * 0.4;
                
                if (score < bestDistance && distance < this.maxDistance) {
                    bestDistance = score;
                    bestMatch = detection;
                    bestDetectionIndex = index;
                }
            });

            if (bestMatch) {
                // Update existing player
                usedDetections.add(bestDetectionIndex);
                this.updatePlayer(playerId, bestMatch, currentTime);
                
                trackedPlayers.push({
                    id: playerId,
                    bbox: {
                        x: bestMatch.x,
                        y: bestMatch.y,
                        width: bestMatch.width,
                        height: bestMatch.height
                    },
                    confidence: bestMatch.confidence,
                    status: 'tracked'
                });

                this.framesSinceLastSeen.set(playerId, 0);
            } else {
                // Player not found in current frame
                const framesSince = this.framesSinceLastSeen.get(playerId) || 0;
                this.framesSinceLastSeen.set(playerId, framesSince + 1);

                // Remove player if not seen for too long
                if (framesSince > this.maxFramesBeforeRemoval) {
                    this.players.delete(playerId);
                    this.framesSinceLastSeen.delete(playerId);
                }
            }
        }

        // Handle unmatched detections
        detections.forEach((detection, index) => {
            if (usedDetections.has(index)) return;

            // Try to reidentify with previously seen players
            const reidentifiedPlayer = this.attemptReidentification(detection);
            
            if (reidentifiedPlayer) {
                // Reidentified player
                this.updatePlayer(reidentifiedPlayer.id, detection, currentTime);
                
                trackedPlayers.push({
                    id: reidentifiedPlayer.id,
                    bbox: {
                        x: detection.x,
                        y: detection.y,
                        width: detection.width,
                        height: detection.height
                    },
                    confidence: detection.confidence,
                    status: 'reidentified'
                });

                this.framesSinceLastSeen.set(reidentifiedPlayer.id, 0);
                
                // Add to history
                this.playerHistory.push({
                    playerId: reidentifiedPlayer.id,
                    action: 'reidentified',
                    time: currentTime,
                    position: [detection.x, detection.y]
                });
            } else {
                // New player
                const newPlayerId = this.nextPlayerId++;
                this.createNewPlayer(newPlayerId, detection, currentTime);
                
                trackedPlayers.push({
                    id: newPlayerId,
                    bbox: {
                        x: detection.x,
                        y: detection.y,
                        width: detection.width,
                        height: detection.height
                    },
                    confidence: detection.confidence,
                    status: 'new'
                });

                this.framesSinceLastSeen.set(newPlayerId, 0);
                
                // Add to history
                this.playerHistory.push({
                    playerId: newPlayerId,
                    action: 'first_detected',
                    time: currentTime,
                    position: [detection.x, detection.y]
                });
            }
        });

        return trackedPlayers;
    }

    createNewPlayer(playerId, detection, currentTime) {
        this.players.set(playerId, {
            id: playerId,
            firstSeen: currentTime,
            lastSeen: currentTime,
            lastPosition: [detection.x, detection.y],
            features: { ...detection.features },
            trackingHistory: [{
                time: currentTime,
                position: [detection.x, detection.y],
                confidence: detection.confidence
            }]
        });
    }

    updatePlayer(playerId, detection, currentTime) {
        const player = this.players.get(playerId);
        if (!player) return;

        player.lastSeen = currentTime;
        player.lastPosition = [detection.x, detection.y];
        
        // Update features with exponential moving average
        this.updateFeatures(player.features, detection.features, 0.3);
        
        player.trackingHistory.push({
            time: currentTime,
            position: [detection.x, detection.y],
            confidence: detection.confidence
        });

        // Keep only recent history
        if (player.trackingHistory.length > 50) {
            player.trackingHistory = player.trackingHistory.slice(-50);
        }
    }

    attemptReidentification(detection) {
        let bestMatch = null;
        let bestSimilarity = 0;

        // Check against all players (including inactive ones)
        for (const [playerId, player] of this.players) {
            const similarity = this.calculateFeatureSimilarity(player.features, detection.features);
            
            if (similarity > bestSimilarity && similarity > this.reidentificationThreshold) {
                bestSimilarity = similarity;
                bestMatch = player;
            }
        }

        return bestMatch;
    }

    calculateDistance(pos1, pos2) {
        const dx = pos1[0] - pos2[0];
        const dy = pos1[1] - pos2[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    calculateFeatureSimilarity(features1, features2) {
        // Color similarity
        const colorSim = this.calculateColorSimilarity(features1.dominantColor, features2.dominantColor);
        
        // Size similarity
        const sizeDiff = Math.abs(features1.size - features2.size);
        const sizeSim = Math.max(0, 1 - sizeDiff);
        
        // Aspect ratio similarity
        const aspectDiff = Math.abs(features1.aspectRatio - features2.aspectRatio);
        const aspectSim = Math.max(0, 1 - aspectDiff * 2);
        
        // Weighted combination
        return colorSim * 0.5 + sizeSim * 0.3 + aspectSim * 0.2;
    }

    calculateColorSimilarity(color1, color2) {
        const rDiff = Math.abs(color1[0] - color2[0]) / 255;
        const gDiff = Math.abs(color1[1] - color2[1]) / 255;
        const bDiff = Math.abs(color1[2] - color2[2]) / 255;
        
        const avgDiff = (rDiff + gDiff + bDiff) / 3;
        return 1 - avgDiff;
    }

    updateFeatures(currentFeatures, newFeatures, alpha) {
        // Exponential moving average for feature updates
        currentFeatures.size = currentFeatures.size * (1 - alpha) + newFeatures.size * alpha;
        currentFeatures.aspectRatio = currentFeatures.aspectRatio * (1 - alpha) + newFeatures.aspectRatio * alpha;
        
        // Color update
        for (let i = 0; i < 3; i++) {
            currentFeatures.dominantColor[i] = 
                currentFeatures.dominantColor[i] * (1 - alpha) + newFeatures.dominantColor[i] * alpha;
        }
    }

    getStats() {
        const totalPlayers = this.nextPlayerId - 1;
        const activePlayers = this.players.size;
        const reidentifications = this.playerHistory.filter(h => h.action === 'reidentified').length;
        
        // Calculate tracking accuracy (simplified)
        const totalFrames = this.playerHistory.length;
        const successfulTracks = this.playerHistory.filter(h => h.action !== 'lost').length;
        const accuracy = totalFrames > 0 ? (successfulTracks / totalFrames * 100).toFixed(1) : 0;
        
        return {
            totalPlayers,
            activePlayers,
            reidentifications,
            accuracy
        };
    }

    getPlayerHistory() {
        // Group history by player
        const playerGroups = new Map();
        
        this.playerHistory.forEach(entry => {
            if (!playerGroups.has(entry.playerId)) {
                playerGroups.set(entry.playerId, []);
            }
            playerGroups.get(entry.playerId).push(entry);
        });
        
        const result = [];
        for (const [playerId, history] of playerGroups) {
            const player = this.players.get(playerId);
            const lastAction = history[history.length - 1];
            
            result.push({
                id: playerId,
                firstSeen: history[0]?.time || 0,
                lastSeen: player?.lastSeen || lastAction?.time || 0,
                totalDetections: history.length,
                reidentifications: history.filter(h => h.action === 'reidentified').length,
                status: this.players.has(playerId) ? 'active' : 'inactive'
            });
        }
        
        return result.sort((a, b) => a.id - b.id);
    }
}