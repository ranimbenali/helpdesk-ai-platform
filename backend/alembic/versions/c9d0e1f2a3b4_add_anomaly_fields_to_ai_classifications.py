"""add anomaly fields to ai_classifications

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-07-29 13:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'c9d0e1f2a3b4'
down_revision = 'b8c9d0e1f2a3'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('ai_classifications', sa.Column('is_anomaly', sa.Boolean(), nullable=True))
    op.add_column('ai_classifications', sa.Column('anomaly_score', sa.Float(), nullable=True))


def downgrade():
    op.drop_column('ai_classifications', 'anomaly_score')
    op.drop_column('ai_classifications', 'is_anomaly')
