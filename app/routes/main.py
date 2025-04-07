# app/routes/main.py
from flask import Blueprint, render_template
from flask_login import login_required, current_user
import logging

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
@login_required
def dashboard():
    logging.info(f"User {current_user.username} accessed dashboard.")
    return render_template('dashboard.html', user=current_user)