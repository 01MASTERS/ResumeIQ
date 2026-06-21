from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


revision = '0a858c18a31e'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'analyses',
        sa.Column(
            'id',
            sa.Integer(),
            primary_key=True,
            autoincrement=True
        ),
        sa.Column(
            'job_description',
            mysql.LONGTEXT(),
            nullable=False
        ),
        sa.Column(
            'created_at',
            sa.DateTime(),
            server_default=sa.text('CURRENT_TIMESTAMP')
        ),
        mysql_engine='InnoDB',
        mysql_charset='utf8mb4'
    )

    op.create_table(
        'candidates',
        sa.Column(
            'id',
            sa.Integer(),
            primary_key=True,
            autoincrement=True
        ),
        sa.Column(
            'analysis_id',
            sa.Integer(),
            nullable=False
        ),
        sa.Column(
            'rank',
            sa.Integer(),
            nullable=False
        ),
        sa.Column(
            'candidate_name',
            sa.String(255),
            nullable=False
        ),
        sa.Column(
            'filename',
            sa.String(255),
            nullable=False
        ),
        sa.Column(
            'score',
            sa.Integer(),
            nullable=False
        ),
        sa.Column(
            'recommendation',
            sa.String(50),
            nullable=False
        ),
        sa.Column(
            'resume_skills',
            sa.JSON(),
            nullable=False
        ),
        sa.Column(
            'matched_skills',
            sa.JSON(),
            nullable=False
        ),
        sa.Column(
            'missing_skills',
            sa.JSON(),
            nullable=False
        ),
        sa.Column(
            'score_breakdown',
            sa.JSON(),
            nullable=False
        ),
        sa.Column(
            'strengths',
            sa.JSON(),
            nullable=False
        ),
        sa.Column(
            'weaknesses',
            sa.JSON(),
            nullable=False
        ),
        sa.Column(
            'resume_text',
            mysql.LONGTEXT(),
            nullable=False
        ),
        sa.Column(
            'explanation',
            mysql.LONGTEXT(),
            nullable=False
        ),
        sa.ForeignKeyConstraint(
            ['analysis_id'],
            ['analyses.id'],
            name='fk_analysis',
            ondelete='CASCADE'
        ),
        mysql_engine='InnoDB',
        mysql_charset='utf8mb4'
    )


def downgrade():
    op.drop_table('candidates')
    op.drop_table('analyses')