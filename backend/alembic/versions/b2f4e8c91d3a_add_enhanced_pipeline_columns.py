"""add enhanced pipeline columns

Revision ID: b2f4e8c91d3a
Revises: 0a858c18a31e
Create Date: 2026-06-21

Adds years_of_experience, llm_verdict, and parsed_sections columns
to the candidates table for the enhanced scoring pipeline.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


revision = 'b2f4e8c91d3a'
down_revision = '0a858c18a31e'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'candidates',
        sa.Column('years_of_experience', sa.Float(), nullable=True)
    )
    op.add_column(
        'candidates',
        sa.Column('llm_verdict', mysql.LONGTEXT(), nullable=True)
    )
    op.add_column(
        'candidates',
        sa.Column('parsed_sections', sa.JSON(), nullable=True)
    )


def downgrade():
    op.drop_column('candidates', 'parsed_sections')
    op.drop_column('candidates', 'llm_verdict')
    op.drop_column('candidates', 'years_of_experience')
