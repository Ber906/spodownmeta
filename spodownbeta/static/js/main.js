// Main JavaScript file for SpoDown app

document.addEventListener('DOMContentLoaded', function() {
    // Chat functionality
    setupChat();
    
    // Profile image upload preview
    setupProfileImageUpload();
    
    // Download functionality (already exists)
    setupDownloadFunctionality();
});

// Chat functionality
function setupChat() {
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    
    if (!chatForm) return; // Not on a page with chat
    
    // Load initial messages
    loadMessages();
    
    // Poll for new messages every 3 seconds
    setInterval(loadMessages, 3000);
    
    // Handle form submission
    chatForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (messageInput.value.trim() === '') return;
        
        // Send message to server
        fetch('/chat/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: messageInput.value
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                messageInput.value = '';
                loadMessages(); // Reload messages
            }
        })
        .catch(error => {
            console.error('Error sending message:', error);
        });
    });
    
    function loadMessages() {
        if (!chatMessages) return;
        
        fetch('/chat/messages')
        .then(response => response.json())
        .then(data => {
            if (data.messages) {
                displayMessages(data.messages, data.current_user_id);
            }
        })
        .catch(error => {
            console.error('Error loading messages:', error);
        });
    }
    
    function displayMessages(messages, currentUserId) {
        // Store scroll position
        const isScrolledToBottom = 
            chatMessages.scrollHeight - chatMessages.clientHeight <= chatMessages.scrollTop + 1;
            
        // Clear messages container first if we're refreshing the whole list
        chatMessages.innerHTML = '';
        
        messages.forEach(message => {
            const isSelf = message.user_id === currentUserId;
            const messageEl = document.createElement('div');
            messageEl.className = `message-container ${isSelf ? 'self' : ''}`;
            
            // Convert timestamp string to readable format
            const timestamp = new Date(message.timestamp);
            const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // Prepare message content
            let mediaContent = '';
            if (message.media_file && message.media_type) {
                if (message.media_type === 'image') {
                    mediaContent = `
                        <div class="message-media">
                            <img src="/static/${message.media_file}" alt="Image" class="img-fluid message-image">
                        </div>
                    `;
                } else if (message.media_type === 'video') {
                    mediaContent = `
                        <div class="message-media">
                            <video controls class="message-video">
                                <source src="/static/${message.media_file}" type="video/mp4">
                                Your browser does not support the video tag.
                            </video>
                        </div>
                    `;
                } else if (message.media_type === 'audio') {
                    mediaContent = `
                        <div class="message-media">
                            <audio controls class="message-audio">
                                <source src="/static/${message.media_file}">
                                Your browser does not support the audio element.
                            </audio>
                        </div>
                    `;
                }
            }
            
            // Build the message HTML
            let messageHTML = '';
            
            // Show avatar only for other users' messages
            if (!isSelf) {
                messageHTML += `
                    <div class="message-avatar-container">
                        <img src="${message.profile_image}" alt="${message.username}" class="message-avatar">
                    </div>
                `;
            }
            
            messageHTML += `<div class="message-group">`;
            
            // Show username only for other users
            if (!isSelf) {
                messageHTML += `<div class="message-sender">${message.username}</div>`;
            }
            
            // Message bubble with text and/or media
            messageHTML += `<div class="message-bubble">`;
            
            // Add text content if available
            if (message.text) {
                messageHTML += `<div class="message-text">${message.text}</div>`;
            }
            
            // Add media content if available
            if (mediaContent) {
                messageHTML += mediaContent;
            }
            
            // Close message bubble
            messageHTML += `</div>`;
            
            // Add timestamp and read receipt for self messages
            messageHTML += `
                <div class="message-time">
                    ${timeString}
                    ${isSelf ? '<i class="fas fa-check-circle message-seen"></i>' : ''}
                </div>
            `;
            
            // Close message group
            messageHTML += `</div>`;
            
            messageEl.innerHTML = messageHTML;
            chatMessages.appendChild(messageEl);
        });
        
        // Scroll to bottom if was at bottom before
        if (isScrolledToBottom) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
}

// Profile image upload functionality
function setupProfileImageUpload() {
    const profileImageInput = document.getElementById('profile-image-input');
    const profileImagePreview = document.getElementById('profile-image-preview');
    
    if (!profileImageInput || !profileImagePreview) return; // Not on profile edit page
    
    profileImageInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                profileImagePreview.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
}

// Download functionality
function setupDownloadFunctionality() {
    // Check if we're on the download page
    const downloadForm = document.getElementById('downloadForm');
    if (!downloadForm) return;
    
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const progressContainer = document.getElementById('progressContainer');
    const outputContainer = document.getElementById('outputContainer');
    const outputText = document.getElementById('outputText');
    const trackList = document.getElementById('trackList');
    const downloadComplete = document.getElementById('downloadComplete');
    const downloadZipLink = document.getElementById('downloadZipLink');
    const cancelBtn = document.getElementById('cancelBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const trackListBtn = document.getElementById('trackListBtn');
    
    let sessionId = null;
    
    downloadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const spotifyUrl = document.getElementById('urlInput').value;
        
        if (!spotifyUrl) {
            Swal.fire({
                title: 'Error!',
                text: 'Please enter a Spotify URL',
                icon: 'error',
                confirmButtonColor: '#1ed760'
            });
            return;
        }
        
        // Start download
        fetch('/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: spotifyUrl
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.session_id) {
                sessionId = data.session_id;
                
                // Show progress and hide form
                downloadForm.style.display = 'none';
                progressContainer.style.display = 'block';
                outputContainer.style.display = 'block';
                cancelBtn.classList.remove('d-none');
                
                // Start polling for progress
                pollProgress();
            } else {
                Swal.fire({
                    title: 'Error!',
                    text: data.error || 'Failed to start download',
                    icon: 'error',
                    confirmButtonColor: '#1ed760'
                });
            }
        })
        .catch(error => {
            console.error('Error starting download:', error);
            Swal.fire({
                title: 'Error!',
                text: 'Failed to connect to the server',
                icon: 'error',
                confirmButtonColor: '#1ed760'
            });
        });
    });
    
    function pollProgress() {
        if (!sessionId) return;
        
        fetch(`/download-progress?session_id=${sessionId}`)
        .then(response => response.json())
        .then(data => {
            if (data.download_complete) {
                // Download complete
                progressBar.style.width = '100%';
                progressText.textContent = '100%';
                
                // Show download complete section
                progressContainer.style.display = 'none';
                outputContainer.style.display = 'none';
                cancelBtn.classList.add('d-none');
                downloadComplete.style.display = 'block';
                downloadZipLink.href = `/download/${sessionId}`;
                
                // Fetch tracks - will only show button for playlists
                fetchTracks();
                
                // Stop polling
                sessionId = null;
            } else {
                // Update progress
                const percentage = data.percentage || 0;
                progressBar.style.width = `${percentage}%`;
                progressText.textContent = `${percentage}%`;
                
                // Update output if available
                fetch(`/output?session_id=${sessionId}`)
                .then(response => response.text())
                .then(output => {
                    if (output && output !== "No such session") {
                        outputText.textContent = output;
                        outputContainer.scrollTop = outputContainer.scrollHeight;
                    }
                });
                
                // Continue polling
                setTimeout(pollProgress, 1000);
            }
        })
        .catch(error => {
            console.error('Error polling progress:', error);
            setTimeout(pollProgress, 1000);
        });
    }
    
    function fetchTracks() {
        if (!sessionId) return;
        
        fetch(`/tracks?session_id=${sessionId}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Error fetching tracks:', data.error);
                return;
            }
            
            if (data.length > 0) {
                trackList.innerHTML = '';
                
                data.forEach((track) => {
                    const trackItem = document.createElement('div');
                    trackItem.className = 'track-item';
                    trackItem.innerHTML = `
                        <div class="track-icon">
                            <i class="fas fa-music"></i>
                        </div>
                        <div class="track-info">
                            <div class="track-title">${track}</div>
                        </div>
                        <div class="track-download">
                            <a href="/download/${sessionId}/${encodeURIComponent(track)}" class="btn btn-sm btn-outline-spotify">
                                <i class="fas fa-download"></i>
                            </a>
                        </div>
                    `;
                    trackList.appendChild(trackItem);
                });
                
                // Only show View Tracks button if we have multiple tracks (playlist)
                if (data.length > 1) {
                    trackListBtn.classList.remove('d-none');
                    
                    trackListBtn.addEventListener('click', function() {
                        if (trackList.style.display === 'none' || !trackList.style.display) {
                            trackList.style.display = 'block';
                            this.innerHTML = '<i class="fas fa-times me-2"></i>Hide Tracks';
                        } else {
                            trackList.style.display = 'none';
                            this.innerHTML = '<i class="fas fa-list me-2"></i>View Tracks';
                        }
                    });
                }
            }
        })
        .catch(error => {
            console.error('Error fetching tracks:', error);
        });
    }
    
    // Cancel download
    cancelBtn.addEventListener('click', function() {
        if (!sessionId) return;
        
        Swal.fire({
            title: 'Cancel Download?',
            text: 'Are you sure you want to cancel this download?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#1ed760',
            cancelButtonColor: '#333',
            confirmButtonText: 'Yes, cancel it!'
        }).then((result) => {
            if (result.isConfirmed) {
                fetch(`/cancel-download?session_id=${sessionId}`, { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        Swal.fire({
                            title: 'Cancelled!',
                            text: 'Your download has been cancelled.',
                            icon: 'success',
                            confirmButtonColor: '#1ed760'
                        });
                        
                        // Reset UI
                        downloadForm.style.display = 'block';
                        progressContainer.style.display = 'none';
                        outputContainer.style.display = 'none';
                        cancelBtn.classList.add('d-none');
                        downloadComplete.style.display = 'none';
                        trackList.style.display = 'none';
                        
                        sessionId = null;
                    } else {
                        Swal.fire({
                            title: 'Error!',
                            text: data.error || 'Failed to cancel download',
                            icon: 'error',
                            confirmButtonColor: '#1ed760'
                        });
                    }
                })
                .catch(error => {
                    console.error('Error cancelling download:', error);
                    Swal.fire({
                        title: 'Error!',
                        text: 'Failed to connect to the server',
                        icon: 'error',
                        confirmButtonColor: '#1ed760'
                    });
                });
            }
        });
    });
}