from flask import Flask, request, send_file, jsonify, render_template, redirect, url_for, flash
import subprocess, json, time, os, zipfile, shutil, logging, mimetypes
from flask_login import LoginManager, login_required, current_user, login_user
from threading import Thread
from sys import platform
import uuid
from werkzeug.utils import secure_filename
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev_key_123")  # For dev only
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 32MB max upload
app.config['UPLOAD_FOLDER'] = 'static/uploads/profile_images'
app.config['CHAT_MEDIA_FOLDER'] = 'static/uploads/chat_media'

# Ensure chat media folder exists
os.makedirs(app.config['CHAT_MEDIA_FOLDER'], exist_ok=True)

# Allowed file extensions for media uploads
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
ALLOWED_VIDEO_EXTENSIONS = {'mp4', 'webm', 'mov', 'avi'}
ALLOWED_AUDIO_EXTENSIONS = {'mp3', 'wav', 'ogg', 'm4a'}

# Login manager setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'authenticate'

@login_manager.user_loader
def load_user(user_id):
    from models import User
    return User.get_by_id(user_id)

# Import routes after app initialization
from routes.auth import auth_bp
app.register_blueprint(auth_bp)

# Create a landing page to choose between OAuth and traditional login
@app.route('/authenticate')
def authenticate():
    return render_template('auth/authenticate.html')

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Global dictionary to store download states
download_states = {}

def install_ffmpeg():
    """Install FFMPEG if needed"""
    try:
        binary = "python3.exe" if platform == "win32" else "python3"
        proc = subprocess.Popen(
            [binary, "-m", "spotdl", "--download-ffmpeg"],
            stdout=subprocess.PIPE,
            stdin=subprocess.PIPE
        )
        time.sleep(5)
        proc.stdin.write(b"y")
        proc.stdin.flush()
        logger.info("FFMPEG installation completed")
    except Exception as e:
        logger.error(f"FFMPEG installation failed: {str(e)}")

def read_stdout(process, session_id):
    """Read stdout and update progress for a specific session"""
    try:
        track_names = []
        while True:
            line = process.stdout.readline()
            if not line:
                # Check if process has completed
                if process.poll() is not None:
                    logger.info(f"Process completed for session {session_id}")
                    # Force 100% completion when process exits normally
                    if session_id in download_states and download_states[session_id]["downloaded_size"] > 0:
                        download_states[session_id]["completed"] = True
                        if download_states[session_id]["downloaded_size"] < download_states[session_id]["num"]:
                            # If we detected fewer downloads than expected tracks, set downloaded to match expected
                            logger.info(f"Adjusting downloaded count for session {session_id}: {download_states[session_id]['downloaded_size']} → {download_states[session_id]['num']}")
                            download_states[session_id]["downloaded_size"] = download_states[session_id]["num"]
                        
                        # Update the download record to mark it as completed
                        try:
                            from utils.db import JsonDB
                            # For playlist, use the comma-separated track names or a default completed status
                            track_name = "Completed" if not track_names else ", ".join(track_names)
                            JsonDB.update_download(download_states[session_id]["download_id"], {
                                "track_name": track_name,
                                "status": "Completed"
                            })
                            logger.info(f"Updated download record {download_states[session_id]['download_id']} to Completed")
                        except Exception as update_error:
                            logger.error(f"Error updating download record: {str(update_error)}")
                break

            if line.startswith(b"Found "):
                try:
                    num_tracks = int(line.split(b" ")[1].decode())
                    download_states[session_id]["num"] = num_tracks
                    logger.info(f"Found {num_tracks} tracks for session {session_id}")
                except ValueError:
                    logger.warning(f"Could not parse track count from line: {line}")

            # Capture track names when they're downloaded
            if line.startswith(b"Downloaded ") or line.startswith(b"Skipping "):
                download_states[session_id]["downloaded_size"] += 1
                logger.info(f"Downloaded track {download_states[session_id]['downloaded_size']}/{download_states[session_id]['num']} for session {session_id}")
                
                # Try to extract track name from the line
                try:
                    decoded_line = line.decode().strip()
                    if 'Downloaded' in decoded_line:
                        # Get text after "Downloaded" and before file extension
                        parts = decoded_line.split("Downloaded ")[1]
                        # Extract just the song name without path and extension
                        if "/" in parts:
                            # Extract filename without extension
                            filename = parts.split("/")[-1].split(".")[0]
                            track_names.append(filename)
                except Exception as e:
                    logger.warning(f"Could not parse track name: {str(e)}")

            download_states[session_id]["output"] += line
            time.sleep(0.05)
    except Exception as e:
        logger.error(f"Error reading stdout: {str(e)}")
        download_states[session_id]["error"] = str(e)

def cleanup_sessions():
    """Cleanup function to delete old sessions after 1 hour"""
    while True:
        current_time = time.time()
        for session_id, state in list(download_states.items()):
            try:
                folder_creation_time = os.path.getctime(state["folder"])
                if current_time - folder_creation_time > 3600:
                    shutil.rmtree(state["folder"])
                    del download_states[session_id]
                    logger.info(f"Cleaned up session: {session_id}")
            except Exception as e:
                logger.error(f"Failed to cleanup session {session_id}: {str(e)}")
        time.sleep(3600)

# Start cleanup thread
Thread(target=cleanup_sessions, daemon=True).start()

# Install FFMPEG on startup
install_ffmpeg()

@app.route('/')
def index():
    return render_template('index.html', user=current_user)

@app.route('/download', methods=['POST'])
@login_required
def start_download():
    try:
        url = request.json.get("url")
        if not url:
            return jsonify({"error": "URL is required"}), 400

        if not url.startswith("https://open.spotify.com/"):
            return jsonify({"error": "Invalid Spotify URL"}), 400

        session_id = str(uuid.uuid4())
        download_folder = f"./downloads/{session_id}/"

        os.makedirs(download_folder, exist_ok=True)

        # Create download record using JSON DB
        download = current_user.add_download(spotify_url=url)

        download_states[session_id] = {
            "output": b"",
            "num": 1,  # Expected number of tracks to download
            "downloaded_size": 0,  # Number of tracks downloaded
            "folder": download_folder,
            "timestamp": time.time(),
            "error": None,
            "process": None,
            "cancelled": False,
            "download_id": download['id'],
            "completed": False  # Flag to mark when process is fully complete
        }

        process = subprocess.Popen(
            ["python3", '-m', 'spotdl', url, '--output', download_folder],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )

        download_states[session_id]["process"] = process
        Thread(target=read_stdout, args=(process, session_id), daemon=True).start()

        return jsonify({"session_id": session_id})

    except Exception as e:
        logger.error(f"Download error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/output')
def get_output():
    session_id = request.args.get('session_id')
    if not session_id or session_id not in download_states:
        return "No such session", 404
    return download_states[session_id]["output"]

@app.route('/download-progress')
def download_progress():
    session_id = request.args.get('session_id')
    if not session_id or session_id not in download_states:
        return jsonify({"error": "No such session"}), 404

    state = download_states[session_id]
    percentage = int((state["downloaded_size"] / state["num"]) * 100) if state["num"] > 0 else 0
    
    # Cap percentage at 100 and mark complete if either condition is met
    if percentage > 100:
        percentage = 100
    
    # Check if download is complete based on completed flag or track count
    download_complete = state["completed"] or state["downloaded_size"] >= state["num"]
    
    # Force 100% when complete
    if download_complete and percentage < 100:
        percentage = 100
        
    return jsonify({
        "percentage": percentage,
        "download_complete": download_complete
    })

@app.route('/download/<session_id>', methods=['GET'])
def download_zip(session_id):
    folder = f"./downloads/{session_id}/"
    if not os.path.exists(folder):
        return jsonify({"error": "No such session"}), 404

    # Check if it's a single track or playlist
    files = [f for f in os.listdir(folder) if f.endswith('.mp3')]
    if len(files) == 1:
        # Single track - return directly
        return send_file(os.path.join(folder, files[0]), as_attachment=True)

    # Multiple tracks - create zip
    zip_filename = f"./downloads/{session_id}.zip"
    with zipfile.ZipFile(zip_filename, 'w') as zf:
        for root, _, files in os.walk(folder):
            for file in files:
                file_path = os.path.join(root, file)
                zf.write(file_path, os.path.relpath(file_path, folder))

    return send_file(zip_filename, as_attachment=True)

@app.route('/tracks')
def get_tracks():
    session_id = request.args.get('session_id')
    if not session_id or session_id not in download_states:
        return jsonify({"error": "No such session"}), 404

    folder = f"./downloads/{session_id}/"
    tracks = [f for f in os.listdir(folder) if f.endswith('.mp3')]
    return jsonify(tracks)

@app.route('/download-track/<session_id>/<track_name>')
def download_track(session_id, track_name):
    track_path = f"./downloads/{session_id}/{track_name}"
    if not os.path.exists(track_path):
        return jsonify({"error": "Track not found"}), 404
    return send_file(track_path, as_attachment=True)

@app.route('/cancel-download', methods=['GET', 'POST'])
def cancel_download():
    # Get session_id from either query params (GET) or form data (POST)
    session_id = request.args.get('session_id')
    
    if not session_id or session_id not in download_states:
        return jsonify({"error": "No such session"}), 404

    state = download_states[session_id]
    try:
        # First terminate the process if it exists
        if state["process"]:
            try:
                state["process"].terminate()
                state["cancelled"] = True
            except Exception as e:
                logger.warning(f"Could not terminate process: {str(e)}")
        
        # Try to remove the download folder if it exists
        if os.path.exists(state["folder"]):
            try:
                shutil.rmtree(state["folder"])
            except Exception as e:
                logger.warning(f"Could not remove folder: {str(e)}")
        
        # Always remove from download_states
        del download_states[session_id]
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Failed to cancel download: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/downloads')
@login_required
def downloads():
    # Get all downloads for the current user
    all_downloads = current_user.get_downloads()

    # Get recent downloads (last 24 hours)
    from datetime import datetime, timedelta
    yesterday = datetime.now() - timedelta(days=1)
    recent_downloads = [
        d for d in all_downloads 
        if datetime.fromisoformat(d['download_date']) > yesterday
    ]

    return render_template(
        'downloads.html',
        downloads=all_downloads,
        recent_downloads=recent_downloads
    )

# Profile routes
@app.route('/profile')
@login_required
def profile():
    # Update user's last active time
    current_user.update_last_active()
    
    return render_template('profile.html', user=current_user)

@app.route('/profile/edit', methods=['GET', 'POST'])
@login_required
def edit_profile():
    from forms import ProfileForm
    
    form = ProfileForm()
    
    if form.validate_on_submit():
        # Handle profile image upload
        profile_image = form.profile_image.data
        filename = None
        
        if profile_image:
            # Secure the filename
            original_filename = secure_filename(profile_image.filename)
            # Add user ID to make it unique
            filename = f"{current_user.id}_{int(time.time())}_{original_filename}"
            
            # Save the file
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            profile_image.save(filepath)
        
        # Update user data
        update_data = {
            'username': form.username.data,
            'email': form.email.data,
            'bio': form.bio.data
        }
        
        if filename:
            update_data['profile_image'] = filename
        
        current_user.update_profile(update_data)
        flash('Profile updated successfully!', 'success')
        return redirect(url_for('profile'))
    
    # Pre-fill form with current user data
    if request.method == 'GET':
        form.username.data = current_user.username
        form.email.data = current_user.email
        form.bio.data = current_user.bio
    
    return render_template('edit_profile.html', form=form, user=current_user)

@app.route('/users')
@login_required
def users():
    from models import User
    all_users = User.get_all_users()
    today = datetime.now().isoformat()[:10]  # Get today's date in YYYY-MM-DD format
    return render_template('users.html', users=all_users, today=today)

@app.route('/user/<user_id>')
@login_required
def user_profile(user_id):
    from models import User
    user = User.get_by_id(user_id)
    if not user:
        flash('User not found', 'error')
        return redirect(url_for('index'))
    
    today = datetime.now().isoformat()
    return render_template('user_profile.html', profile_user=user, now=today)

# Chat routes
@app.route('/chat')
@login_required
def chat():
    from forms import MessageForm
    from models import User
    
    # Update user's last active time
    current_user.update_last_active()
    
    form = MessageForm()
    messages = User.get_recent_messages(50)
    users = User.get_all_users()
    
    today = datetime.now().isoformat()
    return render_template('chat.html', 
                           form=form, 
                           messages=messages, 
                           users=users,
                           current_user=current_user,
                           now=today)

def allowed_file(filename, allowed_extensions):
    """Check if the file has an allowed extension"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

def get_media_type(filename):
    """Determine the media type based on the file extension"""
    extension = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    
    if extension in ALLOWED_IMAGE_EXTENSIONS:
        return 'image'
    elif extension in ALLOWED_VIDEO_EXTENSIONS:
        return 'video'
    elif extension in ALLOWED_AUDIO_EXTENSIONS:
        return 'audio'
    
    return None

@app.route('/chat/send', methods=['POST'])
@login_required
def send_message():
    # Update user's last active time
    current_user.update_last_active()
    
    if request.is_json:
        message_text = request.json.get('message')
        if not message_text and not request.json.get('media_file'):
            return jsonify({'success': False, 'error': 'Message or media is required'}), 400
        
        # Send the message
        current_user.send_message(message_text)
        return jsonify({'success': True})
    
    # Form submission with potential file upload
    message_text = request.form.get('message', '')
    media_file = None
    media_type = None
    
    # Check if a media file was uploaded
    if 'media_file' in request.files:
        file = request.files['media_file']
        
        if file and file.filename:
            if not allowed_file(file.filename, ALLOWED_IMAGE_EXTENSIONS | ALLOWED_VIDEO_EXTENSIONS | ALLOWED_AUDIO_EXTENSIONS):
                flash('File type not allowed', 'error')
                return redirect(url_for('chat'))
            
            # Secure the filename and make it unique
            filename = secure_filename(file.filename)
            unique_filename = f"{current_user.id}_{int(time.time())}_{filename}"
            
            # Determine media type
            media_type = get_media_type(file.filename)
            if media_type == 'voice':  # Special case for voice recordings
                media_type = 'audio'
                
            # Save the file
            file_path = os.path.join(app.config['CHAT_MEDIA_FOLDER'], unique_filename)
            file.save(file_path)
            
            # Store the relative path for the database
            media_file = f"uploads/chat_media/{unique_filename}"
    
    # Send the message with or without media
    if message_text or media_file:
        current_user.send_message(message_text, media_file, media_type)
        return redirect(url_for('chat'))
    
    flash('Message could not be sent', 'error')
    return redirect(url_for('chat'))

@app.route('/chat/messages')
@login_required
def get_messages():
    from models import User
    
    # Update user's last active time
    current_user.update_last_active()
    
    messages = User.get_recent_messages(50)
    return jsonify({
        'success': True, 
        'messages': messages,
        'current_user_id': current_user.id
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)