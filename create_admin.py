from app import create_app, db
from app.models import User
from werkzeug.security import generate_password_hash

app = create_app()
with app.app_context():
    admin = User(username='admin', email='admin@example.com',
                 password_hash=generate_password_hash('adminpass'), role='Admin')
    db.session.add(admin)
    db.session.commit()
    print('Admin user created!')
