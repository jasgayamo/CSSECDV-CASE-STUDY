from flask import Blueprint, render_template, abort
from flask_login import login_required, current_user
import os

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/admin/logs')
@login_required
def view_logs():
    if current_user.role != 'Admin':
        abort(403)
    try:
        with open('logs/app.log', 'r') as log_file:
            logs = log_file.readlines()
        return render_template('admin_logs.html', logs=logs)
    except FileNotFoundError:
        return render_template('admin_logs.html', logs=['Log file not found.'])