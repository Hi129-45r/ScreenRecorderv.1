document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const themeToggle = document.getElementById('themeToggle');
    const settingsToggle = document.getElementById('settingsToggle');
    const settingsPanel = document.getElementById('settingsPanel');
    const previewVideo = document.getElementById('previewVideo');
    const downloadLink = document.getElementById('downloadLink');
    const downloadSection = document.getElementById('downloadSection');
    const recordingIndicator = document.getElementById('recordingIndicator');
    const recordingTime = document.getElementById('recordingTime');
    const soundWaves = document.getElementById('soundWaves');
    const micTestBtn = document.getElementById('micTestBtn');
    const micTestAudio = document.getElementById('micTestAudio');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const notification = document.getElementById('notification');
    const storageLimitInput = document.getElementById('storageLimit');
    
    // Settings elements
    const qualitySelect = document.getElementById('qualitySelect');
    const fpsSelect = document.getElementById('fpsSelect');
    const audioToggle = document.getElementById('audioToggle');
    const formatSelect = document.getElementById('formatSelect');
    const sourceSelect = document.getElementById('sourceSelect');
    
    // Recording variables
    let mediaRecorder;
    let recordedChunks = [];
    let audioStream;
    let screenStream;
    let recordingStartTime;
    let recordingInterval;
    let isPaused = false;
    let pauseStartTime;
    let totalPausedDuration = 0;
    let audioContext;
    let analyser;
    let microphone;
    let isMicActive = false;
    let microphoneAllowed = false;
    let maxStorageMB = 500; // Default storage limit in MB
    let estimatedSizeMB = 0;
    const MB_TO_BYTES = 1024 * 1024;

    // Load saved settings
    loadSettings();
    
    // Event Listeners
    startBtn.addEventListener('click', startRecording);
    stopBtn.addEventListener('click', stopRecording);
    pauseBtn.addEventListener('click', togglePause);
    themeToggle.addEventListener('click', toggleTheme);
    settingsToggle.addEventListener('click', toggleSettings);
    micTestBtn.addEventListener('click', testMicrophone);
    saveSettingsBtn.addEventListener('click', saveSettings);
    downloadLink.addEventListener('click', () => {
        setTimeout(() => {
            URL.revokeObjectURL(downloadLink.href);
            downloadSection.classList.add('hidden');
        }, 100);
    });
    
    // Theme functionality
    function toggleTheme() {
        document.body.classList.toggle('dark-theme');
        const icon = themeToggle.querySelector('i');
        if (document.body.classList.contains('dark-theme')) {
            icon.classList.replace('fa-moon', 'fa-sun');
            localStorage.setItem('theme', 'dark');
            showNotification('Dark mode enabled', 'success');
        } else {
            icon.classList.replace('fa-sun', 'fa-moon');
            localStorage.setItem('theme', 'light');
            showNotification('Light mode enabled', 'success');
        }
    }
    
    // Check for saved theme
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggle.querySelector('i').classList.replace('fa-moon', 'fa-sun');
    }
    
    // Settings panel functionality
    function toggleSettings() {
        settingsPanel.classList.toggle('hidden');
        if (!settingsPanel.classList.contains('hidden')) {
            settingsPanel.classList.add('animate__fadeIn');
        }
    }
    
    // Show notification
    function showNotification(message, type = 'info') {
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    
    // Recording time updater
    function updateRecordingTime() {
        if (!recordingStartTime) return;
        
        const now = Date.now();
        const elapsed = now - recordingStartTime - totalPausedDuration;
        const seconds = Math.floor(elapsed / 1000);
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        recordingTime.textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        // Update size estimation in the notification area
        if (estimatedSizeMB > 0) {
            const sizeInfo = ` (${estimatedSizeMB.toFixed(1)}MB/${maxStorageMB}MB)`;
            if (!recordingTime.textContent.includes(sizeInfo)) {
                recordingTime.textContent += sizeInfo;
            }
        }
    }
    
    // Test microphone
    async function testMicrophone() {
        try {
            if (isMicActive) {
                stopMicrophoneTest();
                micTestBtn.innerHTML = '<i class="fas fa-headphones"></i> Test';
                return;
            }
            
            if (!microphoneAllowed) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioStream = stream;
                microphoneAllowed = true;
            } else {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioStream = stream;
            }
            
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            microphone = audioContext.createMediaStreamSource(audioStream);
            microphone.connect(analyser);
            
            visualizeSound();
            
            micTestAudio.srcObject = audioStream;
            micTestAudio.play();
            
            isMicActive = true;
            micTestBtn.innerHTML = '<i class="fas fa-stop"></i> Stop';
            soundWaves.classList.remove('hidden');
            showNotification('Microphone test started', 'success');
        } catch (err) {
            console.error('Error testing microphone:', err);
            showNotification('Microphone access denied', 'error');
            microphoneAllowed = false;
            audioToggle.checked = false;
        }
    }
    
    function stopMicrophoneTest() {
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
        }
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
        }
        if (micTestAudio) {
            micTestAudio.pause();
            micTestAudio.srcObject = null;
        }
        isMicActive = false;
        soundWaves.classList.add('hidden');
    }
    
    // Visualize sound waves
    function visualizeSound() {
        if (!isMicActive) return;
        
        const waves = document.querySelectorAll('.wave');
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        
        waves.forEach((wave, index) => {
            const value = dataArray[index * 10] || 0;
            const height = 5 + (value / 255) * 20;
            wave.style.height = `${height}px`;
        });
        
        requestAnimationFrame(visualizeSound);
    }
    
    // Start recording function
    async function startRecording() {
        try {
            recordedChunks = [];
            totalPausedDuration = 0;
            estimatedSizeMB = 0;
            
            const screenConstraints = {
                video: {
                    mediaSource: sourceSelect.value,
                    width: { ideal: parseInt(qualitySelect.value) * 16 / 9 },
                    height: { ideal: parseInt(qualitySelect.value) },
                    frameRate: { ideal: parseInt(fpsSelect.value) }
                },
                audio: false
            };
            
            screenStream = await navigator.mediaDevices.getDisplayMedia(screenConstraints);
            
            let combinedStream;
            
            if (audioToggle.checked) {
                try {
                    if (!microphoneAllowed) {
                        const audioConstraints = { 
                            audio: {
                                echoCancellation: true,
                                noiseSuppression: true,
                                autoGainControl: true
                            }, 
                            video: false 
                        };
                        audioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
                        microphoneAllowed = true;
                    } else {
                        const audioConstraints = { 
                            audio: true,
                            video: false 
                        };
                        audioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
                    }
                    
                    combinedStream = new MediaStream([
                        ...screenStream.getVideoTracks(),
                        ...audioStream.getAudioTracks()
                    ]);
                    
                    soundWaves.classList.remove('hidden');
                } catch (audioErr) {
                    console.error('Error accessing microphone:', audioErr);
                    showNotification('Microphone not available', 'warning');
                    combinedStream = screenStream;
                    microphoneAllowed = false;
                    audioToggle.checked = false;
                }
            } else {
                combinedStream = screenStream;
            }
            
            previewVideo.srcObject = combinedStream;
            
            let mimeType;
            if (formatSelect.value === 'mp4') {
                mimeType = 'video/mp4; codecs="avc1.640028, mp4a.40.2"';
            } else if (formatSelect.value === 'gif') {
                mimeType = 'video/webm';
            } else {
                mimeType = 'video/webm; codecs="vp9,opus"';
            }
            
            try {
                mediaRecorder = new MediaRecorder(combinedStream, { mimeType });
            } catch (e) {
                console.warn(`Failed to create MediaRecorder with ${mimeType}, falling back to default`);
                mediaRecorder = new MediaRecorder(combinedStream);
            }
            
            mediaRecorder.ondataavailable = handleDataAvailable;
            mediaRecorder.onstop = handleStop;
            mediaRecorder.onpause = () => {
                isPaused = true;
                pauseStartTime = Date.now();
                pauseBtn.innerHTML = '<i class="fas fa-play"></i> Resume';
                showNotification('Recording paused', 'warning');
            };
            mediaRecorder.onresume = () => {
                isPaused = false;
                totalPausedDuration += Date.now() - pauseStartTime;
                pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
                showNotification('Recording resumed', 'success');
            };
            mediaRecorder.onerror = (e) => {
                console.error('MediaRecorder error:', e);
                showNotification('Recording error occurred', 'error');
            };
            
            mediaRecorder.start(100);
            
            startBtn.disabled = true;
            stopBtn.disabled = false;
            pauseBtn.disabled = false;
            recordingIndicator.classList.remove('hidden');
            recordingStartTime = Date.now();
            
            recordingInterval = setInterval(updateRecordingTime, 1000);
            
            screenStream.getVideoTracks()[0].onended = () => {
                stopRecording();
            };
            
            showNotification('Recording started', 'success');
            
        } catch (err) {
            console.error('Error starting recording:', err);
            showNotification(`Error: ${err.message}`, 'error');
        }
    }
    
    // Handle recording data
    function handleDataAvailable(event) {
        if (event.data.size > 0 && !isPaused) {
            recordedChunks.push(event.data);
            
            // Calculate estimated size
            estimatedSizeMB = (event.data.size / MB_TO_BYTES) * recordedChunks.length;
            
            // Check if we're approaching the limit (stop at 90% to be safe)
            if (estimatedSizeMB > maxStorageMB * 0.9) {
                showNotification(`Recording stopped - reached ${Math.round(estimatedSizeMB)}MB of ${maxStorageMB}MB limit`, 'warning');
                stopRecording();
            }
        }
    }
    
    // Stop recording function
    async function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            
            if (previewVideo.srcObject) {
                previewVideo.srcObject.getTracks().forEach(track => track.stop());
            }
            if (audioStream) {
                audioStream.getTracks().forEach(track => track.stop());
            }
            
            clearInterval(recordingInterval);
            soundWaves.classList.add('hidden');
        }
    }
    
    // Handle recording stop
    async function handleStop() {
        estimatedSizeMB = 0;
        
        const format = formatSelect.value;
        let blobType;
        
        if (format === 'mp4') {
            blobType = 'video/mp4';
        } else if (format === 'gif') {
            blobType = 'image/gif';
        } else {
            blobType = 'video/webm';
        }
        
        const blob = new Blob(recordedChunks, { type: blobType });
        
        // Calculate file size
        const fileSize = (blob.size / (1024 * 1024)).toFixed(2);
        document.getElementById('fileSize').textContent = `${fileSize} MB`;
        
        const url = URL.createObjectURL(blob);
        previewVideo.srcObject = null;
        previewVideo.src = url;
        previewVideo.controls = true;
        
        // Set up download link
        downloadLink.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadLink.download = `recording_${timestamp}.${format}`;
        downloadSection.classList.remove('hidden');
        
        // Reset UI
        startBtn.disabled = false;
        stopBtn.disabled = true;
        pauseBtn.disabled = true;
        recordingIndicator.classList.add('hidden');
        isPaused = false;
        
        showNotification('Recording saved successfully', 'success');
    }
    
    // Pause/resume functionality
    function togglePause() {
        if (!mediaRecorder) return;
        
        if (isPaused) {
            mediaRecorder.resume();
        } else {
            mediaRecorder.pause();
        }
    }
    
    // Save settings to localStorage
    function saveSettings() {
        const settings = {
            quality: qualitySelect.value,
            fps: fpsSelect.value,
            audio: audioToggle.checked,
            format: formatSelect.value,
            source: sourceSelect.value,
            storageLimit: parseInt(storageLimitInput.value) || 500
        };
        
        maxStorageMB = settings.storageLimit;
        localStorage.setItem('screenRecorderSettings', JSON.stringify(settings));
        showNotification('Settings saved', 'success');
    }
    
    // Load settings from localStorage
    function loadSettings() {
        const savedSettings = localStorage.getItem('screenRecorderSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            
            qualitySelect.value = settings.quality || '720';
            fpsSelect.value = settings.fps || '24';
            audioToggle.checked = settings.audio || false;
            formatSelect.value = settings.format || 'webm';
            sourceSelect.value = settings.source || 'screen';
            maxStorageMB = parseInt(settings.storageLimit) || 500;
            
            if (storageLimitInput) {
                storageLimitInput.value = maxStorageMB;
            }
        }
    }
    
    // Check for browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        showNotification('Screen recording not supported in your browser', 'error');
        startBtn.disabled = true;
    }
    
    // Initialize with animations
    setTimeout(() => {
        document.querySelector('h1').classList.remove('animate__fadeIn');
    }, 1000);
});
