"""add fonction to users

Revision ID: c1d2e3f4a5b6
Revises: b3c9d2e1f0a5
Create Date: 2026-05-13 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b3c9d2e1f0a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('fonction', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'fonction')
