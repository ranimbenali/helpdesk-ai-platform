"""create system_logs table

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-05-13 15:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'system_logs',
        sa.Column('log_id',     sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('event_type', sa.String(60),   nullable=False),
        sa.Column('category',   sa.String(50),   nullable=True),
        sa.Column('user_id',    sa.BigInteger(), sa.ForeignKey('users.user_id', ondelete='SET NULL'), nullable=True),
        sa.Column('user_name',  sa.String(255),  nullable=True),
        sa.Column('detail',     sa.Text(),        nullable=True),
        sa.Column('severity',   sa.String(20),   server_default='Info'),
        sa.Column('ip_address', sa.String(50),   nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_system_logs_created_at', 'system_logs', ['created_at'])


def downgrade():
    op.drop_index('ix_system_logs_created_at', table_name='system_logs')
    op.drop_table('system_logs')
