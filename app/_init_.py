from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_migrate import Migrate
from logging.config import dictConfig
import os

# Logging setup
dictConfig({
    'version': 1,
    'formatters': {'default': {'format': '[%(asctime)s] %(levelname)s in %(module)s: %(message)s'}},
    'handlers': {
        'file': {
            'class': 'logging.FileHandler',
            'filename': 'logs/app.log',
            'formatter': 'default'
        }
    },
    'root': {
        'level': 'INFO',
        'handlers': ['file']
    }
})

db = SQLAlchemy()
login_manager = LoginManager()
migrate = Migrate()


def create_app():
    app = Flask(__name__)
    app.config.from_object('config.Config')

    db.init_app(app)
    login_manager.init_app(app)
    migrate.init_app(app, db)

    from app.routes.auth import auth_bp
    from app.routes.main import main_bp
    from app.routes.admin import admin_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(admin_bp)

    return app