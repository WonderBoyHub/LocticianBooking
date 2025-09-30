#!/usr/bin/env python3
"""Utility script to queue and process a test email."""

import argparse
import asyncio
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import structlog

# Ensure backend modules are importable when running from repository root.
REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_SRC = REPO_ROOT / "src" / "backend"
if str(BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC))

from app.core.config import settings
from app.core.database import get_db_session, init_db
from app.services.email_service import email_service

logger = structlog.get_logger(__name__)


@dataclass
class EmailSendResult:
    queue_id: Optional[str]
    status: str
    provider_message_id: Optional[str]


async def _send_email(
    *,
    to_email: str,
    subject: str,
    message: str,
    to_name: Optional[str],
    from_email: Optional[str],
    from_name: Optional[str],
) -> EmailSendResult:
    """Queue an email when possible, otherwise fall back to direct delivery."""

    try:
        await init_db()

        async with get_db_session() as session:
            queue_entry = await email_service.queue_email(
                to_email=to_email,
                subject=subject,
                html_content=f"<p>{message}</p>",
                text_content=message,
                to_name=to_name,
                from_email=from_email,
                from_name=from_name,
                session=session,
            )

            await email_service.process_email_queue(batch_size=1, session=session)

            await session.refresh(queue_entry)

            return EmailSendResult(
                queue_id=queue_entry.id,
                status=queue_entry.status.value,
                provider_message_id=queue_entry.provider_message_id,
            )
    except Exception as exc:
        logger.warning(
            "Queueing email failed; falling back to direct send",
            error=str(exc),
        )

    success, provider_message_id = await email_service.sender.send_email(
        to_email=to_email,
        to_name=to_name or "",
        subject=subject,
        html_content=f"<p>{message}</p>",
        text_content=message,
        from_email=from_email,
        from_name=from_name,
    )

    if not success:
        raise RuntimeError(provider_message_id or "Unable to send email")

    return EmailSendResult(
        queue_id=None,
        status="sent",
        provider_message_id=provider_message_id,
    )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Send a test email using the local queue")
    parser.add_argument("to_email", help="Recipient email address")
    parser.add_argument(
        "--subject",
        default="Loctician Booking Test Email",
        help="Subject for the test email",
    )
    parser.add_argument(
        "--message",
        default="Hej! Dette er en testmail fra Loctician Booking systemet.",
        help="Plain text message to include in the email",
    )
    parser.add_argument(
        "--to-name",
        default=None,
        help="Optional recipient name",
    )
    parser.add_argument(
        "--from-email",
        default=settings.SMTP_FROM,
        help="Override the configured sender email",
    )
    parser.add_argument(
        "--from-name",
        default=settings.SMTP_FROM_NAME,
        help="Override the configured sender name",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()

    try:
        result = asyncio.run(
            _send_email(
                to_email=args.to_email,
                subject=args.subject,
                message=args.message,
                to_name=args.to_name,
                from_email=args.from_email,
                from_name=args.from_name,
            )
        )
    except Exception as exc:  # pragma: no cover - CLI diagnostics
        logger.error("Failed to send test email", error=str(exc))
        raise SystemExit(1) from exc

    logger.info(
        "Test email processed",
        queue_id=result.queue_id,
        status=result.status,
        provider_message_id=result.provider_message_id,
    )

    output_message = [
        "Email queued and processed successfully.",
        f"Queue ID: {result.queue_id or 'N/A'}",
        f"Status: {result.status}",
    ]

    if result.provider_message_id:
        output_message.append(f"Debug output: {result.provider_message_id}")

    print("\n".join(output_message))


if __name__ == "__main__":
    main()
