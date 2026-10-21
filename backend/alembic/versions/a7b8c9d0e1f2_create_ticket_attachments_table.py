"""create ticket_attachments table

Revision ID: a7b8c9d0e1f2
Revises: f1a2b3c4d5e6
Create Date: 2026-07-29 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'a7b8c9d0e1f2'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'ticket_attachments',
        sa.Column('attachment_id',    sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('ticket_id',        sa.BigInteger(), sa.ForeignKey('tickets.ticket_id', ondelete='CASCADE'), nullable=False),
        sa.Column('original_name',    sa.String(255),  nullable=False),
        sa.Column('stored_name',      sa.String(255),  nullable=False),
        sa.Column('content_type',     sa.String(100),  nullable=True),
        sa.Column('size_bytes',       sa.BigInteger(), nullable=False),
        sa.Column('uploaded_by',      sa.BigInteger(), sa.ForeignKey('users.user_id', ondelete='SET NULL'), nullable=True),
        sa.Column('uploaded_by_name', sa.String(255),  nullable=True),
        sa.Column('created_at',       sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_ticket_attachments_ticket_id', 'ticket_attachments', ['ticket_id'])


def downgrade():
    op.drop_index('ix_ticket_attachments_ticket_id', table_name='ticket_attachments')
    op.drop_table('ticket_attachments')
