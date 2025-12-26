from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from config import Config

db = SQLAlchemy()
login = LoginManager()
login.login_view = 'auth.login'
csrf = CSRFProtect()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    login.init_app(app)
    csrf.init_app(app)

    # Import and register blueprints here (will add in later steps)
    from app.routes.auth_routes import bp as auth_bp
    app.register_blueprint(auth_bp)

    from app.routes import main_routes
    app.register_blueprint(main_routes.bp)

    return app

from app import models
@login.user_loader
def load_user(id):
    return models.User.query.get(int(id))
