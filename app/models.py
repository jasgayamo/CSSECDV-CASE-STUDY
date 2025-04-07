from app import db
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    failed_logins = db.Column(db.Integer, default=0)
    lockout_time = db.Column(db.DateTime, nullable=True)
    last_login = db.Column(db.DateTime, nullable=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def is_account_locked(self):
        if self.lockout_time:
            return datetime.utcnow() < self.lockout_time
        return False

    def lock_account(self):
        self.lockout_time = datetime.utcnow() + timedelta(seconds=300)

    def reset_failed_logins(self):
        self.failed_logins = 0
        self.lockout_time = None

    def __repr__(self):
        return f'<User {self.username}>'