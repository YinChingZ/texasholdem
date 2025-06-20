// 音效管理工具
export class SoundManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.enabled = true;
        this.volume = 0.3;        this.lastPlayTime = {}; // 防抖机制：记录上次播放时间
        this.minInterval = 50; // 最小播放间隔（毫秒），减少到50ms
        
        // 初始化音频上下文
        this.initAudioContext();
    }    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('Audio context created:', this.audioContext.state);
            
            // 现代浏览器需要用户交互才能启用音频
            if (this.audioContext.state === 'suspended') {
                console.log('Audio context suspended, will resume on user interaction');
                // 添加一次性事件监听器来恢复音频上下文
                const resumeAudio = () => {
                    this.audioContext.resume().then(() => {
                        console.log('Audio context resumed');
                    });
                    document.removeEventListener('click', resumeAudio);
                    document.removeEventListener('keydown', resumeAudio);
                };
                document.addEventListener('click', resumeAudio);
                document.addEventListener('keydown', resumeAudio);
            }
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
            this.enabled = false;
        }
    }

    // 防抖检查
    canPlaySound(soundType) {
        const now = Date.now();
        const lastTime = this.lastPlayTime[soundType] || 0;
        
        if (now - lastTime < this.minInterval) {
            return false;
        }
        
        this.lastPlayTime[soundType] = now;
        return true;
    }    // 创建音效（使用Web Audio API生成）
    createSound(frequency, duration, type = 'sine') {
        if (!this.audioContext || !this.enabled) {
            console.log('Cannot create sound: audioContext missing or disabled');
            return null;
        }

        if (this.audioContext.state === 'suspended') {
            console.log('Audio context suspended, attempting to resume');
            this.audioContext.resume();
        }

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = type;
            
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(this.volume, this.audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
            
            console.log('Sound created successfully:', { frequency, duration, type, volume: this.volume });
            return { oscillator, gainNode };
        } catch (e) {
            console.error('Error creating sound:', e);
            return null;
        }
    }// 播放筹码增加音效
    playChipGain() {
        if (!this.enabled || !this.canPlaySound('chipGain')) return;
        
        const sound = this.createSound(800, 0.3, 'triangle');
        if (sound) {
            sound.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            sound.gainNode.gain.linearRampToValueAtTime(this.volume * 0.5, this.audioContext.currentTime + 0.01);
            sound.gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
            
            sound.oscillator.start();
            sound.oscillator.stop(this.audioContext.currentTime + 0.3);
            
            // 添加和声
            setTimeout(() => {
                const harmony = this.createSound(1200, 0.2, 'triangle');
                if (harmony) {
                    harmony.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                    harmony.gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, this.audioContext.currentTime + 0.01);
                    harmony.gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
                    
                    harmony.oscillator.start();
                    harmony.oscillator.stop(this.audioContext.currentTime + 0.2);
                }
            }, 100);
        }
    }    // 播放筹码减少音效
    playChipLoss() {
        if (!this.enabled || !this.canPlaySound('chipLoss')) return;
        
        const sound = this.createSound(300, 0.4, 'sawtooth');
        if (sound) {
            sound.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            sound.gainNode.gain.linearRampToValueAtTime(this.volume * 0.4, this.audioContext.currentTime + 0.01);
            sound.gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.4);
            
            sound.oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.4);
            sound.oscillator.start();
            sound.oscillator.stop(this.audioContext.currentTime + 0.4);
        }
    }    // 播放奖池增加音效
    playPotIncrease() {
        if (!this.enabled || !this.canPlaySound('potIncrease')) return;
        
        const sound = this.createSound(600, 0.5, 'square');
        if (sound) {
            sound.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            sound.gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, this.audioContext.currentTime + 0.01);
            sound.gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
            
            sound.oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.5);
            sound.oscillator.start();
            sound.oscillator.stop(this.audioContext.currentTime + 0.5);
        }
    }    // 播放下注音效（根据金额调整音调和持续时间）
    playBet(amount = 0) {
        if (!this.enabled || !this.canPlaySound('bet')) return;
        
        // 根据下注金额调整音效参数
        let frequency = 440; // 基础频率
        let duration = 0.2;  // 基础持续时间
        let oscillatorType = 'triangle';
        
        if (amount > 0) {
            // 小额下注 (1-50)
            if (amount <= 50) {
                frequency = 440;
                duration = 0.15;
                oscillatorType = 'triangle';
            }
            // 中等下注 (51-200)
            else if (amount <= 200) {
                frequency = 550;
                duration = 0.25;
                oscillatorType = 'square';
            }
            // 大额下注 (201-500)
            else if (amount <= 500) {
                frequency = 660;
                duration = 0.35;
                oscillatorType = 'sawtooth';
            }
            // 巨额下注 (500+)
            else {
                frequency = 880;
                duration = 0.5;
                oscillatorType = 'square';
                // 添加和弦效果
                setTimeout(() => {
                    const harmony = this.createSound(frequency * 1.5, duration * 0.6, 'triangle');
                    if (harmony) {
                        harmony.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                        harmony.gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, this.audioContext.currentTime + 0.01);
                        harmony.gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration * 0.6);
                        
                        harmony.oscillator.start();
                        harmony.oscillator.stop(this.audioContext.currentTime + duration * 0.6);
                    }
                }, 50);
            }
        }
        
        const sound = this.createSound(frequency, duration, oscillatorType);
        if (sound) {
            sound.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            sound.gainNode.gain.linearRampToValueAtTime(this.volume * 0.6, this.audioContext.currentTime + 0.01);
            sound.gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
            
            sound.oscillator.start();
            sound.oscillator.stop(this.audioContext.currentTime + duration);
        }
    }    // 播放翻牌音效
    playCardFlip() {
        console.log('playCardFlip called, enabled:', this.enabled);
        if (!this.enabled || !this.canPlaySound('cardFlip')) {
            console.log('Card flip sound blocked by settings or debounce');
            return;
        }
        
        console.log('Playing card flip sound');
        const sound = this.createSound(880, 0.15, 'square');
        if (sound) {
            sound.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            sound.gainNode.gain.linearRampToValueAtTime(this.volume * 0.4, this.audioContext.currentTime + 0.01);
            sound.gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
            
            // 添加快速频率变化模拟翻牌声
            sound.oscillator.frequency.exponentialRampToValueAtTime(1100, this.audioContext.currentTime + 0.05);
            sound.oscillator.frequency.exponentialRampToValueAtTime(700, this.audioContext.currentTime + 0.15);
            
            sound.oscillator.start();
            sound.oscillator.stop(this.audioContext.currentTime + 0.15);
            console.log('Card flip sound started');
        } else {
            console.log('Failed to create card flip sound');
        }
    }    // 播放全押音效
    playAllIn() {
        console.log('playAllIn called, enabled:', this.enabled);
        if (!this.enabled || !this.canPlaySound('allIn')) {
            console.log('All-in sound blocked by settings or debounce');
            return;
        }
        
        console.log('Playing all-in sound');
        // 创建戏剧性的全押音效
        const sound1 = this.createSound(220, 0.6, 'sawtooth');
        if (sound1) {
            sound1.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            sound1.gainNode.gain.linearRampToValueAtTime(this.volume * 0.7, this.audioContext.currentTime + 0.1);
            sound1.gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.6);
            
            sound1.oscillator.frequency.exponentialRampToValueAtTime(440, this.audioContext.currentTime + 0.6);
            sound1.oscillator.start();
            sound1.oscillator.stop(this.audioContext.currentTime + 0.6);
            console.log('All-in base sound started');
        }

        // 添加高音装饰音
        setTimeout(() => {
            const sound2 = this.createSound(1760, 0.3, 'triangle');
            if (sound2) {
                sound2.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                sound2.gainNode.gain.linearRampToValueAtTime(this.volume * 0.5, this.audioContext.currentTime + 0.01);
                sound2.gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
                
                sound2.oscillator.start();
                sound2.oscillator.stop(this.audioContext.currentTime + 0.3);
                console.log('All-in decoration sound started');
            }
        }, 200);
    }// 设置音量
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        console.log('Sound volume set to:', this.volume);
    }

    // 启用/禁用音效
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log('Sound enabled:', this.enabled);
    }

    // 获取当前设置
    getSettings() {
        return {
            enabled: this.enabled,
            volume: this.volume
        };
    }
}

// 创建全局音效管理器实例
export const soundManager = new SoundManager();
