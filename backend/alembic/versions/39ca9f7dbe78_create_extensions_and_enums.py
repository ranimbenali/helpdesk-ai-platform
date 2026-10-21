"""create extensions and enums

Revision ID: 39ca9f7dbe78
Revises: 
Create Date: 2026-03-04 11:02:58.505742

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '39ca9f7dbe78'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
    op.execute('CREATE EXTENSION IF NOT EXISTS "citext";')

    op.execute("CREATE TYPE user_role AS ENUM ('REQUESTER','AGENT','SUPERVISOR','ADMIN');")
    op.execute("CREATE TYPE user_status AS ENUM ('ACTIVE','ARCHIVED');")
    pass

def downgrade() -> None:
    op.execute("DROP TYPE IF EXISTS user_status;")
    op.execute("DROP TYPE IF EXISTS user_role;")
    pass
