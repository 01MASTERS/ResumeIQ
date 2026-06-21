"""add candidate email

Revision ID: c3e5f9d02e4b
Revises: b2f4e8c91d3a
Create Date: 2026-06-21

Adds candidate_email column to the candidates table.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


revision = 'c3e5f9d02e4b'
down_revision = 'b2f4e8c91d3a'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'candidates',
        sa.Column('candidate_email', sa.String(255), nullable=True)
    )

def downgrade():
    op.drop_column('candidates', 'candidate_email')
