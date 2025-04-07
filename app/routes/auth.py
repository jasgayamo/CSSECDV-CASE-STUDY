from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_user, logout_user, login_required, current_user
from app.forms import LoginForm, RegistrationForm
from app.models import User
from app import db
from datetime import datetime
import logging

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))

    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user and not user.is_account_locked():
            if user.check_password(form.password.data):
                user.reset_failed_logins()
                user.last_login = datetime.utcnow()
                db.session.commit()
                login_user(user)
                logging.info(f"User {user.username} logged in successfully.")
                return redirect(url_for('main.dashboard'))
            else:
                user.failed_logins += 1
                if user.failed_logins >= 5:
                    user.lock_account()
                    flash('Account locked due to too many failed login attempts.', 'danger')
                    logging.warning(f"User {user.username} account locked.")
                else:
                    flash('Incorrect username or password.', 'danger')
                db.session.commit()
        else:
            flash('Account is locked or does not exist.', 'danger')
    return render_template('login.html', form=form)

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))

    form = RegistrationForm()
    if form.validate_on_submit():
        user = User(username=form.username.data, email=form.email.data, role=form.role.data)
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        flash('Registration successful. Please log in.', 'success')
        logging.info(f"New user registered: {user.username}")
        return redirect(url_for('auth.login'))
    return render_template('register.html', form=form)

@auth_bp.route('/logout')
@login_required
def logout():
    logging.info(f"User {current_user.username} logged out.")
    logout_user()
    return redirect(url_for('auth.login'))
