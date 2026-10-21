"""add supervisor notification prefs to users

Revision ID: 83323b18fa47
Revises: 4cbba9e808ae
Create Date: 2026-08-20 00:06:45.230223

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '83323b18fa47'
down_revision: Union[str, Sequence[str], None] = '4cbba9e808ae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('notify_sla_breach', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('users', sa.Column('notify_ticket_closed', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('notify_agent_idle', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('notify_email_digest', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('users', sa.Column('notify_inapp', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'notify_inapp')
    op.drop_column('users', 'notify_email_digest')
    op.drop_column('users', 'notify_agent_idle')
    op.drop_column('users', 'notify_ticket_closed')
    op.drop_column('users', 'notify_sla_breach')
