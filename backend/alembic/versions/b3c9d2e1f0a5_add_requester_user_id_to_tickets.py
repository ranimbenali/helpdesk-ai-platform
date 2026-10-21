"""add requester_user_id to tickets

Revision ID: b3c9d2e1f0a5
Revises: a57fc14b8cab
Create Date: 2026-05-13 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b3c9d2e1f0a5'
down_revision: Union[str, None] = 'a57fc14b8cab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tickets',
        sa.Column('requester_user_id', sa.BigInteger(), sa.ForeignKey('users.user_id'), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('tickets', 'requester_user_id')
