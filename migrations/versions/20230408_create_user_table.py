# In migrations/versions/{generated_script}.py
from alembic import op
import sqlalchemy as sa

# Required for Alembic to track migration history
revision = '20230408_create_user_table'  # A unique identifier for this migration
down_revision = None  # If this is the first migration, use None

def upgrade():
    # Create the User table
    op.create_table(
        'user',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=80), nullable=False),
        sa.Column('email', sa.String(length=120), nullable=False),
        sa.Column('password_hash', sa.String(length=128), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),  # Add role if needed
        sa.Column('failed_logins', sa.Integer(), default=0, nullable=False),
        sa.Column('lockout_time', sa.DateTime(), nullable=True),
        sa.Column('last_login', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username'),
        sa.UniqueConstraint('email')
    )

def downgrade():
    # Drop the User table
    op.drop_table('user')
