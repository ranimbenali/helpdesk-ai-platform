"""add agent notification prefs to users

Revision ID: 4cbba9e808ae
Revises: 4c20739b634a
Create Date: 2026-08-19 22:55:56.798849

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4cbba9e808ae'
down_revision: Union[str, Sequence[str], None] = '4c20739b634a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('notify_new_ticket', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('users', sa.Column('notify_sla_risk', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('users', sa.Column('notify_mention', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('users', sa.Column('notify_daily_digest', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('notify_sounds', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'notify_sounds')
    op.drop_column('users', 'notify_daily_digest')
    op.drop_column('users', 'notify_mention')
    op.drop_column('users', 'notify_sla_risk')
    op.drop_column('users', 'notify_new_ticket')
