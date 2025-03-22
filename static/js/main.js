// Main JavaScript file for SpoDown app

// Global variable to track the current download mode - default to search
let currentDownloadMode = 'search';

document.addEventListener('DOMContentLoaded', function() {
    // Chat functionality
    setupChat();
    
    // Profile image upload preview
    setupProfileImageUpload();
    
    // Mode toggle
    setupModeToggle();
    
    // Download functionality (already exists)
    setupDownloadFunctionality();
    
    // Spotify Search functionality
    setupSpotifySearch();
});

// Setup mode toggle functionality
function setupModeToggle() {
    const searchModeBtn = document.getElementById('searchModeBtn');
    const urlModeBtn = document.getElementById('urlModeBtn');
    const searchMode = document.getElementById('searchMode');
    const urlMode = document.getElementById('urlMode');
    
    if (!searchModeBtn || !urlModeBtn) return; // Not on a page with mode toggle
    
    // Set default mode (search)
    searchModeBtn.classList.add('active');
    urlModeBtn.classList.remove('active');
    if (searchMode) searchMode.style.display = 'block';
    if (urlMode) urlMode.style.display = 'none';
    
    // Switch to search mode when button is clicked
    searchModeBtn.addEventListener('click', function() {
        currentDownloadMode = 'search';
        searchModeBtn.classList.add('active');
        urlModeBtn.classList.remove('active');
        if (searchMode) searchMode.style.display = 'block';
        if (urlMode) urlMode.style.display = 'none';
    });
    
    // Switch to URL mode when button is clicked
    urlModeBtn.addEventListener('click', function() {
        currentDownloadMode = 'url';
        urlModeBtn.classList.add('active');
        searchModeBtn.classList.remove('active');
        if (searchMode) searchMode.style.display = 'none';
        if (urlMode) urlMode.style.display = 'block';
    });
}

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
        
        // Start download with the current mode
        fetch('/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: spotifyUrl,
                mode: currentDownloadMode // Use the global mode variable
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

// Spotify Search functionality
function setupSpotifySearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const searchResults = document.getElementById('searchResults');
    
    if (!searchInput || !searchBtn || !searchResults) return; // Not on a page with search
    
    // Search when button is clicked
    searchBtn.addEventListener('click', function() {
        performSearch();
    });
    
    // Search when Enter key is pressed
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    function performSearch() {
        const query = searchInput.value.trim();
        if (!query) return;
        
        // Show loading indicator
        searchResults.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-spotify" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 text-muted">Searching Spotify...</p>
            </div>
        `;
        
        // Fetch search results from API
        fetch(`/api/search?q=${encodeURIComponent(query)}&type=track`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.results && data.results.length > 0) {
                displaySearchResults(data.results);
            } else {
                searchResults.innerHTML = `
                    <div class="text-center py-4">
                        <i class="fas fa-search fa-3x text-muted mb-3"></i>
                        <p>No results found for "${query}"</p>
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Error searching Spotify:', error);
            searchResults.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-exclamation-circle fa-3x text-danger mb-3"></i>
                    <p>Error searching Spotify. Please try again.</p>
                </div>
            `;
        });
    }
    
    function displaySearchResults(results) {
        searchResults.innerHTML = '';
        
        results.forEach(track => {
            const trackCard = document.createElement('div');
            trackCard.className = 'track-card';
            
            // Create image element with fallback
            const imageUrl = track.image_url || '/static/img/default.svg';
            
            trackCard.innerHTML = `
                <img src="${imageUrl}" alt="${track.name}" class="track-image">
                <div class="track-info">
                    <div class="track-name">${track.name}</div>
                    <div class="track-artist">${track.artists}</div>
                    <div class="track-actions">
                        <button class="btn btn-sm btn-spotify download-track-btn">
                            <i class="fas fa-download"></i> Download
                        </button>
                        <a href="${track.spotify_url}" target="_blank" class="btn btn-sm btn-outline-spotify">
                            <i class="fab fa-spotify"></i>
                        </a>
                    </div>
                </div>
            `;
            
            // Add event listener to download button
            const downloadBtn = trackCard.querySelector('.download-track-btn');
            downloadBtn.addEventListener('click', function() {
                // Create and show a progress modal for search mode
                Swal.fire({
                    title: 'Downloading...',
                    html: `
                        <div class="mb-3">
                            <strong>${track.name}</strong> by ${track.artists}
                        </div>
                        <div class="progress mb-3">
                            <div class="progress-bar bg-spotify" id="searchProgressBar" role="progressbar" style="width: 0%" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                        </div>
                        <div id="searchProgressText" class="mb-3">Initializing download...</div>
                        <div class="search-output-container mt-3 mb-3">
                            <pre id="searchOutputText" class="text-start small bg-light p-2 rounded" style="height: 100px; overflow-y: auto;"></pre>
                        </div>
                    `,
                    showCancelButton: true,
                    showConfirmButton: false,
                    cancelButtonText: 'Cancel Download',
                    allowOutsideClick: false,
                    didOpen: () => {
                        // Start download when modal opens
                        startSearchDownload();
                    }
                }).then((result) => {
                    // If modal is dismissed (cancel button clicked)
                    if (result.dismiss === Swal.DismissReason.cancel && window.searchSessionId) {
                        // Cancel the download
                        fetch(`/cancel-download?session_id=${window.searchSessionId}`)
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    Swal.fire({
                                        title: 'Download Cancelled',
                                        icon: 'info',
                                        confirmButtonColor: '#1ed760'
                                    });
                                }
                            })
                            .catch(error => console.error('Error cancelling download:', error));
                    }
                });
                
                function startSearchDownload() {
                    // Start download with search mode for search results
                    fetch('/download', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            url: track.spotify_url,
                            mode: 'search' // Always use search mode for search results
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.session_id) {
                            const sessionId = data.session_id;
                            window.searchSessionId = sessionId; // Store globally for cancellation
                            
                            // Get references to the elements in the Swal modal
                            const searchProgressBar = document.getElementById('searchProgressBar');
                            const searchProgressText = document.getElementById('searchProgressText');
                            const searchOutputText = document.getElementById('searchOutputText');
                            
                            // Start polling progress
                            let progressInterval = setInterval(function() {
                                fetch(`/download-progress?session_id=${sessionId}`)
                                .then(response => response.json())
                                .then(progressData => {
                                    if (progressData.download_complete) {
                                        // Download complete
                                        if (searchProgressBar) searchProgressBar.style.width = '100%';
                                        if (searchProgressText) searchProgressText.textContent = 'Download complete!';
                                        
                                        // Clear interval
                                        clearInterval(progressInterval);
                                        
                                        // Get tracks to determine if it's a single track or playlist
                                        fetch(`/tracks?session_id=${sessionId}`)
                                        .then(response => response.json())
                                        .then(tracksData => {
                                            // Close the progress modal
                                            Swal.close();
                                            
                                            if (tracksData.length > 0) {
                                                if (tracksData.length === 1) {
                                                    // Single track - offer direct download
                                                    Swal.fire({
                                                        title: 'Download Complete!',
                                                        html: `
                                                            <div class="mb-3">
                                                                <strong>${track.name}</strong> has been downloaded successfully!
                                                            </div>
                                                        `,
                                                        icon: 'success',
                                                        confirmButtonText: 'Download File',
                                                        showCancelButton: true,
                                                        cancelButtonText: 'Close',
                                                        confirmButtonColor: '#1ed760'
                                                    }).then((result) => {
                                                        if (result.isConfirmed) {
                                                            // Trigger download
                                                            window.location.href = `/download/${sessionId}`;
                                                        }
                                                    });
                                                } else {
                                                    // Multiple tracks - show track list
                                                    let trackListHtml = '<div class="track-list-container">';
                                                    tracksData.forEach((trackName) => {
                                                        trackListHtml += `
                                                            <div class="track-item d-flex justify-content-between align-items-center my-2 p-2 bg-light rounded">
                                                                <div class="track-info d-flex align-items-center">
                                                                    <i class="fas fa-music me-2"></i>
                                                                    <span>${trackName}</span>
                                                                </div>
                                                                <a href="/download/${sessionId}/${encodeURIComponent(trackName)}" class="btn btn-sm btn-outline-spotify">
                                                                    <i class="fas fa-download"></i>
                                                                </a>
                                                            </div>
                                                        `;
                                                    });
                                                    trackListHtml += '</div>';
                                                    
                                                    Swal.fire({
                                                        title: 'Download Complete!',
                                                        html: `
                                                            <div class="mb-3">
                                                                The playlist has been downloaded successfully!
                                                            </div>
                                                            <div class="text-start mb-3">${trackListHtml}</div>
                                                        `,
                                                        icon: 'success',
                                                        confirmButtonText: 'Download ZIP',
                                                        showCancelButton: true,
                                                        cancelButtonText: 'Close',
                                                        confirmButtonColor: '#1ed760',
                                                        width: '600px'
                                                    }).then((result) => {
                                                        if (result.isConfirmed) {
                                                            // Trigger ZIP download
                                                            window.location.href = `/download/${sessionId}`;
                                                        }
                                                    });
                                                }
                                            }
                                        })
                                        .catch(error => console.error('Error fetching tracks:', error));
                                    } else {
                                        // Update progress
                                        const percentage = progressData.percentage || 0;
                                        if (searchProgressBar) {
                                            searchProgressBar.style.width = `${percentage}%`;
                                            searchProgressBar.setAttribute('aria-valuenow', percentage);
                                        }
                                        if (searchProgressText) {
                                            searchProgressText.textContent = `Downloading: ${percentage}%`;
                                        }
                                    }
                                })
                                .catch(error => {
                                    console.error('Error polling progress:', error);
                                });
                                
                                // Update output text
                                fetch(`/output?session_id=${sessionId}`)
                                .then(response => response.text())
                                .then(output => {
                                    if (output && output !== "No such session" && searchOutputText) {
                                        searchOutputText.textContent = output;
                                        searchOutputText.scrollTop = searchOutputText.scrollHeight;
                                    }
                                })
                                .catch(error => console.error('Error fetching output:', error));
                            }, 1000);
                        } else {
                            // Close the progress modal and show error
                            Swal.close();
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
                        // Close the progress modal and show error
                        Swal.close();
                        Swal.fire({
                            title: 'Error!',
                            text: 'Failed to connect to the server',
                            icon: 'error',
                            confirmButtonColor: '#1ed760'
                        });
                    });
                }
            });
            
            searchResults.appendChild(trackCard);
        });
    }
}