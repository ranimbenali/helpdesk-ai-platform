"""add cluster_id to ai_classifications

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-07-29 14:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'd0e1f2a3b4c5'
down_revision = 'c9d0e1f2a3b4'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('ai_classifications', sa.Column('cluster_id', sa.BigInteger(), nullable=True))


def downgrade():
    op.drop_column('ai_classifications', 'cluster_id')
