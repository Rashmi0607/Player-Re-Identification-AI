export class UIController {
    constructor() {
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.playersDetected = document.getElementById('playersDetected');
        this.reidentifications = document.getElementById('reidentifications');
        this.trackingAccuracy = document.getElementById('trackingAccuracy');
        this.playerHistory = document.getElementById('playerHistory');
    }

    updateProgress(percentage, message) {
        if (this.progressFill) {
            this.progressFill.style.width = `${percentage}%`;
        }
        
        if (this.progressText) {
            this.progressText.textContent = message;
        }
    }

    updateStats(stats) {
        if (this.playersDetected) {
            this.animateNumber(this.playersDetected, stats.totalPlayers);
        }
        
        if (this.reidentifications) {
            this.animateNumber(this.reidentifications, stats.reidentifications);
        }
        
        if (this.trackingAccuracy) {
            this.trackingAccuracy.textContent = `${stats.accuracy}%`;
        }
    }

    updatePlayerHistory(history) {
        if (!this.playerHistory) return;
        
        this.playerHistory.innerHTML = '';
        
        history.forEach(player => {
            const playerElement = this.createPlayerHistoryElement(player);
            this.playerHistory.appendChild(playerElement);
        });
    }

    createPlayerHistoryElement(player) {
        const element = document.createElement('div');
        element.className = 'player-entry';
        
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
        const color = colors[player.id % colors.length];
        
        element.innerHTML = `
            <div class="player-id" style="background-color: ${color}">
                ${player.id}
            </div>
            <div class="player-info">
                <div class="player-name">Player ${player.id}</div>
                <div class="player-status">
                    ${player.status === 'active' ? '🟢 Active' : '🔴 Inactive'} • 
                    ${player.totalDetections} detections • 
                    ${player.reidentifications} re-IDs
                </div>
            </div>
        `;
        
        return element;
    }

    animateNumber(element, targetValue) {
        const currentValue = parseInt(element.textContent) || 0;
        const increment = targetValue > currentValue ? 1 : -1;
        const duration = 500; // ms
        const steps = Math.abs(targetValue - currentValue);
        const stepDuration = steps > 0 ? duration / steps : 0;
        
        if (steps === 0) return;
        
        let current = currentValue;
        const timer = setInterval(() => {
            current += increment;
            element.textContent = current;
            
            if (current === targetValue) {
                clearInterval(timer);
            }
        }, stepDuration);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '600',
            zIndex: '1000',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease'
        });
        
        // Set background color based on type
        const colors = {
            info: '#3498db',
            success: '#27ae60',
            warning: '#f39c12',
            error: '#e74c3c'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after delay
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    updateVideoInfo(videoFile) {
        const infoElement = document.getElementById('videoInfo');
        if (!infoElement) return;
        
        const fileSize = (videoFile.size / (1024 * 1024)).toFixed(2);
        const duration = videoFile.duration || 'Unknown';
        
        infoElement.innerHTML = `
            <div class="video-info-card">
                <h4>📹 Video Information</h4>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">File Name:</span>
                        <span class="info-value">${videoFile.name}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">File Size:</span>
                        <span class="info-value">${fileSize} MB</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Duration:</span>
                        <span class="info-value">${duration}s</span>
                    </div>
                </div>
            </div>
        `;
    }

    highlightActivePlayer(playerId) {
        const playerElements = this.playerHistory.querySelectorAll('.player-entry');
        
        playerElements.forEach(element => {
            const playerIdElement = element.querySelector('.player-id');
            const currentId = parseInt(playerIdElement.textContent);
            
            if (currentId === playerId) {
                element.style.backgroundColor = '#f0f8ff';
                element.style.transform = 'scale(1.02)';
                element.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            } else {
                element.style.backgroundColor = '';
                element.style.transform = '';
                element.style.boxShadow = '';
            }
        });
    }

    createLoadingSpinner() {
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        spinner.innerHTML = `
            <div class="spinner-circle"></div>
            <div class="spinner-text">Processing video...</div>
        `;
        
        // Add spinner styles
        const style = document.createElement('style');
        style.textContent = `
            .loading-spinner {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 40px;
            }
            
            .spinner-circle {
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #667eea;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 15px;
            }
            
            .spinner-text {
                color: #718096;
                font-size: 0.9rem;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        
        if (!document.querySelector('style[data-spinner]')) {
            style.setAttribute('data-spinner', 'true');
            document.head.appendChild(style);
        }
        
        return spinner;
    }
}