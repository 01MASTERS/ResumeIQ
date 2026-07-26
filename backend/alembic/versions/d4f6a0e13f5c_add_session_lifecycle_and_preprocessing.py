"""add session lifecycle and preprocessing columns

Revision ID: d4f6a0e13f5c
Revises: c3e5f9d02e4b
Create Date: 2026-07-26

Adds all columns required by the new staged processing pipeline.
Uses IF NOT EXISTS guards (via try/except) so the migration is
safe to re-run if partially applied.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import mysql

revision = 'd4f6a0e13f5c'
down_revision = 'c3e5f9d02e4b'
branch_labels = None
depends_on = None


def _column_exists(conn, table: str, column: str) -> bool:
    """Return True if the column already exists in the table."""
    result = conn.execute(
        text(
            "SELECT COUNT(*) FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() "
            "AND TABLE_NAME = :table AND COLUMN_NAME = :col"
        ),
        {"table": table, "col": column},
    )
    return result.scalar() > 0


def _add_if_missing(conn, table: str, column: str, col_def: sa.Column):
    """Add a column only if it does not already exist."""
    if not _column_exists(conn, table, column):
        op.add_column(table, col_def)


def upgrade():
    conn = op.get_bind()

    # ── analyses table ────────────────────────────────────────────────────────
    _add_if_missing(conn, 'analyses', 'status',
        sa.Column('status', sa.String(20), nullable=False, server_default='completed',
                  comment='created|uploading|preprocessing|ready|analyzing|completed|failed|expired'))

    _add_if_missing(conn, 'analyses', 'jd_skills',
        sa.Column('jd_skills', sa.JSON(), nullable=True))

    _add_if_missing(conn, 'analyses', 'jd_required_yoe',
        sa.Column('jd_required_yoe', sa.Float(), nullable=True))

    _add_if_missing(conn, 'analyses', 'knockout_criteria',
        sa.Column('knockout_criteria', sa.JSON(), nullable=True))

    _add_if_missing(conn, 'analyses', 'expires_at',
        sa.Column('expires_at', sa.DateTime(), nullable=True))

    _add_if_missing(conn, 'analyses', 'updated_at',
        sa.Column('updated_at', sa.DateTime(), nullable=True,
                  server_default=sa.text('CURRENT_TIMESTAMP')))

    _add_if_missing(conn, 'analyses', 'total_candidates',
        sa.Column('total_candidates', sa.Integer(), nullable=False, server_default='0'))

    _add_if_missing(conn, 'analyses', 'preprocessed_count',
        sa.Column('preprocessed_count', sa.Integer(), nullable=False, server_default='0'))

    _add_if_missing(conn, 'analyses', 'completed_count',
        sa.Column('completed_count', sa.Integer(), nullable=False, server_default='0'))

    _add_if_missing(conn, 'analyses', 'failed_count',
        sa.Column('failed_count', sa.Integer(), nullable=False, server_default='0'))

    # ── candidates table ──────────────────────────────────────────────────────
    _add_if_missing(conn, 'candidates', 'status',
        sa.Column('status', sa.String(30), nullable=False, server_default='completed',
                  comment='uploaded|preprocessing|preprocessed|preprocessing_failed|evaluating|completed|evaluation_failed'))

    _add_if_missing(conn, 'candidates', 'preprocessing_data',
        sa.Column('preprocessing_data', sa.JSON(), nullable=True))

    _add_if_missing(conn, 'candidates', 'error_message',
        sa.Column('error_message', sa.Text(), nullable=True))

    _add_if_missing(conn, 'candidates', 'retry_count',
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'))

    _add_if_missing(conn, 'candidates', 'preprocessed_at',
        sa.Column('preprocessed_at', sa.DateTime(), nullable=True))

    _add_if_missing(conn, 'candidates', 'evaluated_at',
        sa.Column('evaluated_at', sa.DateTime(), nullable=True))

    # Make existing required fields nullable so the staged pipeline can
    # insert candidates with minimal data (score/recommendation populated later).
    # MySQL requires each MODIFY COLUMN in a separate ALTER TABLE statement.
    # `rank` is a reserved word in MySQL — must be backtick-quoted.
    conn.execute(text("ALTER TABLE candidates MODIFY COLUMN `rank` INT NULL"))
    conn.execute(text("ALTER TABLE candidates MODIFY COLUMN score INT NULL"))
    conn.execute(text("ALTER TABLE candidates MODIFY COLUMN recommendation VARCHAR(50) NULL"))
    conn.execute(text("ALTER TABLE candidates MODIFY COLUMN explanation LONGTEXT NULL"))
    conn.execute(text("ALTER TABLE candidates MODIFY COLUMN resume_skills JSON NULL"))
    conn.execute(text("ALTER TABLE candidates MODIFY COLUMN matched_skills JSON NULL"))
    conn.execute(text("ALTER TABLE candidates MODIFY COLUMN missing_skills JSON NULL"))
    conn.execute(text("ALTER TABLE candidates MODIFY COLUMN score_breakdown JSON NULL"))
    conn.execute(text("ALTER TABLE candidates MODIFY COLUMN strengths JSON NULL"))
    conn.execute(text("ALTER TABLE candidates MODIFY COLUMN weaknesses JSON NULL"))


def downgrade():
    conn = op.get_bind()

    # Restore nullable back to NOT NULL (best effort — may fail on existing NULLs)
    try:
        conn.execute(text(
            "ALTER TABLE candidates "
            "MODIFY COLUMN rank INT NOT NULL, "
            "MODIFY COLUMN score INT NOT NULL, "
            "MODIFY COLUMN recommendation VARCHAR(50) NOT NULL, "
            "MODIFY COLUMN explanation LONGTEXT NOT NULL"
        ))
    except Exception:
        pass

    for col in ['evaluated_at', 'preprocessed_at', 'retry_count',
                'error_message', 'preprocessing_data', 'status']:
        if _column_exists(conn, 'candidates', col):
            op.drop_column('candidates', col)

    for col in ['failed_count', 'completed_count', 'preprocessed_count',
                'total_candidates', 'updated_at', 'expires_at',
                'knockout_criteria', 'jd_required_yoe', 'jd_skills', 'status']:
        if _column_exists(conn, 'analyses', col):
            op.drop_column('analyses', col)
