import json
import os
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any

# Ensure data directory exists
DATA_DIR = "data"
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# File paths
USERS_FILE = os.path.join(DATA_DIR, "users.json")
DOWNLOADS_FILE = os.path.join(DATA_DIR, "downloads.json")
MESSAGES_FILE = os.path.join(DATA_DIR, "messages.json")

def load_json(file_path: str) -> dict:
    """Load JSON file, create if not exists"""
    if os.path.exists(file_path):
        with open(file_path, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return {}
    return {}

def save_json(file_path: str, data: dict):
    """Save data to JSON file"""
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2, default=str)

class JsonDB:
    @staticmethod
    def get_user_by_email(email: str) -> Optional[Dict]:
        users = load_json(USERS_FILE)
        return next((user for user in users.values() if user.get('email') == email), None)
        
    @staticmethod
    def get_user_by_oauth_id(oauth_id: str) -> Optional[Dict]:
        users = load_json(USERS_FILE)
        return next((user for user in users.values() if user.get('oauth_id') == oauth_id), None)

    @staticmethod
    def get_user_by_id(user_id: str) -> Optional[Dict]:
        users = load_json(USERS_FILE)
        return users.get(user_id)
        
    @staticmethod
    def get_all_users() -> List[Dict]:
        users = load_json(USERS_FILE)
        return list(users.values())

    @staticmethod
    def create_user(user_data: Dict) -> Dict:
        users = load_json(USERS_FILE)
        user_id = str(len(users) + 1)
        user_data['id'] = user_id
        users[user_id] = user_data
        save_json(USERS_FILE, users)
        return user_data
        
    @staticmethod
    def update_user(user_id: str, update_data: Dict) -> Optional[Dict]:
        users = load_json(USERS_FILE)
        if user_id in users:
            users[user_id].update(update_data)
            save_json(USERS_FILE, users)
            return users[user_id]
        return None

    @staticmethod
    def add_download(user_id: str, download_data: Dict) -> Dict:
        downloads = load_json(DOWNLOADS_FILE)
        download_id = str(len(downloads) + 1)
        download_data.update({
            'id': download_id,
            'user_id': user_id,
            'download_date': datetime.now().isoformat()
        })
        downloads[download_id] = download_data
        save_json(DOWNLOADS_FILE, downloads)
        return download_data

    @staticmethod
    def get_user_downloads(user_id: str) -> List[Dict]:
        downloads = load_json(DOWNLOADS_FILE)
        return [
            download for download in downloads.values()
            if download['user_id'] == user_id
        ]

    @staticmethod
    def update_download(download_id: str, update_data: Dict) -> Optional[Dict]:
        downloads = load_json(DOWNLOADS_FILE)
        if download_id in downloads:
            downloads[download_id].update(update_data)
            save_json(DOWNLOADS_FILE, downloads)
            return downloads[download_id]
        return None
        
    # Message system methods for global chat
    @staticmethod
    def add_message(user_id: str, message_text: Optional[str] = None, media_file: Optional[str] = None, media_type: Optional[str] = None) -> Dict:
        """Add a new message to the global chat
        
        Args:
            user_id: The ID of the user sending the message
            message_text: Optional text content of the message
            media_file: Optional path to a media file
            media_type: Optional type of media (image, video, audio, voice)
        """
        messages = load_json(MESSAGES_FILE)
        message_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        message_data = {
            'id': message_id,
            'user_id': user_id,
            'text': message_text if message_text else '',
            'media_file': media_file if media_file else '',
            'media_type': media_type if media_type else '',
            'timestamp': timestamp
        }
        
        if not messages:
            messages = {}
            
        messages[message_id] = message_data
        save_json(MESSAGES_FILE, messages)
        return message_data
    
    @staticmethod
    def get_messages(limit: int = 50) -> List[Dict]:
        """Get most recent messages, with newest last"""
        messages = load_json(MESSAGES_FILE)
        all_messages = list(messages.values())
        
        # Sort by timestamp (oldest first)
        all_messages.sort(key=lambda x: x.get('timestamp', ''))
        
        # Return the most recent messages (limited)
        return all_messages[-limit:] if limit > 0 else all_messages