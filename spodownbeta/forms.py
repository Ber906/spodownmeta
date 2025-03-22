from flask_wtf import FlaskForm
from flask_wtf.file import FileField, FileAllowed
from wtforms import StringField, PasswordField, SubmitField, TextAreaField, SelectField, validators
from wtforms.validators import DataRequired, Length, EqualTo, Optional
# Use a simple validator instead of Email() to avoid email-validator dependency
from wtforms.validators import Regexp

class SignupForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=4, max=50)])
    email = StringField('Email', validators=[
        DataRequired(),
        Regexp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', 
               message='Please enter a valid email address')
    ])
    password = PasswordField('Password', validators=[DataRequired(), Length(min=6)])
    confirm_password = PasswordField(
        'Confirm Password', 
        validators=[DataRequired(), EqualTo('password', message='Passwords must match')]
    )
    submit = SubmitField('Sign Up')

class SigninForm(FlaskForm):
    email = StringField('Email', validators=[
        DataRequired(),
        Regexp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', 
               message='Please enter a valid email address')
    ])
    password = PasswordField('Password', validators=[DataRequired()])
    submit = SubmitField('Sign In')

class ProfileForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=4, max=50)])
    email = StringField('Email', validators=[
        DataRequired(),
        Regexp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', 
               message='Please enter a valid email address')
    ])
    bio = TextAreaField('Bio', validators=[Optional(), Length(max=500)])
    profile_image = FileField('Profile Image', validators=[
        Optional(),
        FileAllowed(['jpg', 'jpeg', 'png', 'gif'], 'Images only!')
    ])
    submit = SubmitField('Update Profile')

class MessageForm(FlaskForm):
    message = TextAreaField('Message', validators=[Optional(), Length(max=1000)])
    media_file = FileField('Upload Media', validators=[
        Optional(),
        FileAllowed(['jpg', 'jpeg', 'png', 'gif', 'mp3', 'mp4', 'wav', 'ogg', 'webm'], 
                    'Supported formats: images, audio and video files')
    ])
    submit = SubmitField('Send')
