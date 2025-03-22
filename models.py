from flask_login import UserMixin
from utils.db import JsonDB
from werkzeug.security import generate_password_hash, check_password_hash
import os
from datetime import datetime

class User(UserMixin):
    def __init__(self, user_data):
        self.id = user_data.get('id')
        self.username = user_data.get('username')
        self.email = user_data.get('email')
        self.password_hash = user_data.get('password_hash')
        self.profile_image = user_data.get('profile_image', 'default.png')
        self.bio = user_data.get('bio', '')
        self.oauth_id = user_data.get('oauth_id')
        self.oauth_provider = user_data.get('oauth_provider')
        self.created_at = user_data.get('created_at', datetime.now().isoformat())
        self.last_active = user_data.get('last_active', datetime.now().isoformat())

    @staticmethod
    def get_by_email(email):
        user_data = JsonDB.get_user_by_email(email)
        return User(user_data) if user_data else None
        
    @staticmethod
    def get_by_oauth_id(oauth_id):
        user_data = JsonDB.get_user_by_oauth_id(oauth_id)
        return User(user_data) if user_data else None

    @staticmethod
    def get_by_id(user_id):
        user_data = JsonDB.get_user_by_id(user_id)
        return User(user_data) if user_data else None

    @staticmethod
    def create(username, email, password=None, oauth_provider=None, oauth_id=None):
        user_data = {
            'username': username,
            'email': email,
            'profile_image': 'default.png',
            'bio': '',
            'oauth_provider': oauth_provider,
            'oauth_id': oauth_id,
            'created_at': datetime.now().isoformat(),
            'last_active': datetime.now().isoformat()
        }
        
        if password:
            user_data['password_hash'] = generate_password_hash(password)
            
        created_user = JsonDB.create_user(user_data)
        return User(created_user)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def get_downloads(self):
        return JsonDB.get_user_downloads(self.id)

    def add_download(self, spotify_url, track_name="Pending...", status="Pending"):
        return JsonDB.add_download(self.id, {
            'spotify_url': spotify_url,
            'track_name': track_name,
            'status': status
        })
        
    def update_profile(self, data):
        """Update user profile data"""
        return JsonDB.update_user(self.id, data)
        
    def get_profile_image_url(self):
        """Get the user's profile image URL"""
        if self.profile_image == 'default.png' or not self.profile_image:
            return '/static/img/default.svg'
        return f'/static/uploads/profile_images/{self.profile_image}'
    
    def update_last_active(self):
        """Update the user's last active timestamp"""
        data = {'last_active': datetime.now().isoformat()}
        return JsonDB.update_user(self.id, data)
        
    @staticmethod
    def get_all_users():
        """Get all users for the chat system"""
        return [User(user_data) for user_data in JsonDB.get_all_users()]
        
    # Chat methods
    def send_message(self, message_text=None, media_file=None, media_type=None):
        """Send a message to the global chat
        
        Args:
            message_text: Optional text content
            media_file: Optional path to the media file
            media_type: Optional type of media (image, video, audio, voice)
        """
        # Ensure we don't pass None to the database function
        text = message_text if message_text is not None else ""
        media = media_file if media_file is not None else ""
        media_t = media_type if media_type is not None else ""
        
        return JsonDB.add_message(self.id, text, media, media_t)
    
    @staticmethod
    def get_recent_messages(limit=50):
        """Get the most recent messages"""
        messages = JsonDB.get_messages(limit)
        # Enrich messages with user information
        for message in messages:
            user_id = message.get('user_id')
            user = User.get_by_id(user_id)
            if user:
                message['username'] = user.username
                message['profile_image'] = user.get_profile_image_url()
            else:
                message['username'] = 'Unknown User'
                message['profile_image'] = '/static/img/default.svg'
        return messages

class Message:
    """Message model for the chat system"""
    def __init__(self, message_data):
        self.id = message_data.get('id')
        self.user_id = message_data.get('user_id')
        self.text = message_data.get('text')
        self.media_file = message_data.get('media_file')
        self.media_type = message_data.get('media_type')
        self.timestamp = message_data.get('timestamp')
        
        # Get associated user
        user = User.get_by_id(self.user_id)
        if user:
            self.username = user.username
            self.profile_image = user.get_profile_image_url()
        else:
            self.username = 'Unknown User'
            self.profile_image = '/static/img/default.svg'
    
    def format_timestamp(self):
        """Format the timestamp for display"""
        dt = datetime.fromisoformat(self.timestamp)
        return dt.strftime('%b %d, %Y %I:%M %p')
        
    def get_media_url(self):
        """Get URL for media file if present"""
        if self.media_file:
            return f'/static/uploads/chat_media/{self.media_file}'
        return None