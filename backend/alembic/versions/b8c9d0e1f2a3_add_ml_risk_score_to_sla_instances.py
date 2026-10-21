"""add ml_risk_score to sla_instances

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-07-29 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'b8c9d0e1f2a3'
down_revision = 'a7b8c9d0e1f2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('sla_instances', sa.Column('ml_risk_score', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('sla_instances', 'ml_risk_score')
