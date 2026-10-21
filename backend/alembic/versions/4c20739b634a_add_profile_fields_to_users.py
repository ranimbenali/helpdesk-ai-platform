"""add profile fields to users

Revision ID: 4c20739b634a
Revises: d0e1f2a3b4c5
Create Date: 2026-08-19 22:15:30.256204

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c20739b634a'
down_revision: Union[str, Sequence[str], None] = 'd0e1f2a3b4c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('phone', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('preferred_language', sa.Text(), nullable=False, server_default='Français'))
    op.add_column('users', sa.Column('notify_reply', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('users', sa.Column('notify_resolved', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('users', sa.Column('notify_news', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('notify_weekly', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'notify_weekly')
    op.drop_column('users', 'notify_news')
    op.drop_column('users', 'notify_resolved')
    op.drop_column('users', 'notify_reply')
    op.drop_column('users', 'preferred_language')
    op.drop_column('users', 'phone')
