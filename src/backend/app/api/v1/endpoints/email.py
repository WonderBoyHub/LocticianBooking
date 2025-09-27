"""
Email management API endpoints.
Handles email templates, queue management, and sending operations.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, validator
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_admin_or_staff
from app.core.database import get_db
from app.models.email_template import EmailQueue, EmailTemplate
from app.models.enums import EmailStatus, TemplateType
from app.models.user import User
from app.services.email_service import email_service

logger = structlog.get_logger(__name__)

router = APIRouter()


# Pydantic Models
class EmailTemplateCreate(BaseModel):
    """Email template creation model."""
    name: str = Field(..., min_length=1, max_length=100)
    template_type: TemplateType
    subject: str = Field(..., min_length=1, max_length=200)
    html_content: str = Field(..., min_length=1)
    text_content: Optional[str] = None
    available_variables: Optional[Dict[str, Any]] = None

    class Config:
        use_enum_values = True


class EmailTemplateUpdate(BaseModel):
    """Email template update model."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    subject: Optional[str] = Field(None, min_length=1, max_length=200)
    html_content: Optional[str] = Field(None, min_length=1)
    text_content: Optional[str] = None
    available_variables: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

    class Config:
        use_enum_values = True


class EmailTemplateResponse(BaseModel):
    """Email template response model."""
    id: str
    name: str
    template_type: TemplateType
    subject: str
    html_content: str
    text_content: Optional[str]
    available_variables: Optional[Dict[str, Any]]
    version: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str]

    class Config:
        from_attributes = True
        use_enum_values = True


class EmailQueueCreate(BaseModel):
    """Email queue creation model."""
    to_email: str = Field(..., pattern=r'^[^@]+@[^@]+\.[^@]+$')
    to_name: Optional[str] = None
    subject: str = Field(..., min_length=1, max_length=500)
    template_type: Optional[TemplateType] = None
    template_variables: Optional[Dict[str, Any]] = None
    html_content: Optional[str] = None
    text_content: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    user_id: Optional[str] = None
    booking_id: Optional[str] = None
    scheduled_at: Optional[datetime] = None

    @validator('html_content', 'text_content')
    def validate_content(cls, v, values):
        """Validate that at least one content type is provided if no template."""
        if not values.get('template_type') and not v and not values.get('html_content') and not values.get('text_content'):
            raise ValueError('Either template_type or content must be provided')
        return v

    class Config:
        use_enum_values = True


class EmailQueueResponse(BaseModel):
    """Email queue response model."""
    id: str
    template_id: Optional[str]
    to_email: str
    to_name: Optional[str]
    from_email: str
    from_name: Optional[str]
    subject: str
    status: EmailStatus
    attempts: int
    max_attempts: int
    scheduled_at: datetime
    sent_at: Optional[datetime]
    failed_at: Optional[datetime]
    error_message: Optional[str]
    provider_message_id: Optional[str]
    created_at: datetime
    user_id: Optional[str]
    booking_id: Optional[str]

    class Config:
        from_attributes = True
        use_enum_values = True


class EmailSendRequest(BaseModel):
    """Direct email send request."""
    to_email: str = Field(..., pattern=r'^[^@]+@[^@]+\.[^@]+$')
    to_name: Optional[str] = None
    subject: str = Field(..., min_length=1, max_length=500)
    template_type: Optional[TemplateType] = None
    template_variables: Optional[Dict[str, Any]] = None
    html_content: Optional[str] = None
    text_content: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None

    class Config:
        use_enum_values = True


class QueueStatsResponse(BaseModel):
    """Email queue statistics response."""
    total_emails: int
    queued: int
    sending: int
    sent: int
    failed: int
    bounced: int
    oldest_queued: Optional[datetime]
    processing_rate: float  # emails per minute


# Template Management Endpoints
@router.get("/templates/", response_model=List[EmailTemplateResponse])
async def get_email_templates(
    template_type: Optional[TemplateType] = Query(None),
    is_active: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """
    Get email templates with optional filtering.

    - **template_type**: Filter by template type
    - **is_active**: Filter by active status
    - **skip**: Number of templates to skip
    - **limit**: Number of templates to return
    """
    query = select(EmailTemplate)

    conditions = []
    if template_type:
        conditions.append(EmailTemplate.template_type == template_type)
    if is_active is not None:
        conditions.append(EmailTemplate.is_active == is_active)

    if conditions:
        query = query.where(and_(*conditions))

    query = query.order_by(
        desc(EmailTemplate.is_active),
        EmailTemplate.template_type,
        desc(EmailTemplate.version)
    ).offset(skip).limit(limit)

    result = await db.execute(query)
    templates = result.scalars().all()

    logger.info(
        "Email templates retrieved",
        count=len(templates),
        user_id=current_user.id
    )

    return templates


@router.get("/templates/{template_id}", response_model=EmailTemplateResponse)
async def get_email_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """Get specific email template by ID."""
    result = await db.execute(
        select(EmailTemplate).where(EmailTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email template not found"
        )

    return template


@router.post("/templates/", response_model=EmailTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_email_template(
    template_data: EmailTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """
    Create new email template.

    Creates a new email template and deactivates existing templates of the same type.
    """
    try:
        template = await email_service.create_template(
            name=template_data.name,
            template_type=template_data.template_type,
            subject=template_data.subject,
            html_content=template_data.html_content,
            text_content=template_data.text_content,
            available_variables=template_data.available_variables,
            created_by=current_user.id,
            session=db
        )

        logger.info(
            "Email template created",
            template_id=template.id,
            template_type=template_data.template_type,
            user_id=current_user.id
        )

        return template

    except Exception as e:
        logger.error(
            "Failed to create email template",
            error=str(e),
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create email template"
        )


@router.put("/templates/{template_id}", response_model=EmailTemplateResponse)
async def update_email_template(
    template_id: str,
    template_data: EmailTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """Update existing email template."""
    result = await db.execute(
        select(EmailTemplate).where(EmailTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email template not found"
        )

    # Update fields
    update_data = template_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    # Increment version if content changed
    if any(field in update_data for field in ['subject', 'html_content', 'text_content']):
        template.version += 1

    await db.commit()
    await db.refresh(template)

    logger.info(
        "Email template updated",
        template_id=template_id,
        user_id=current_user.id
    )

    return template


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_email_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """Deactivate email template (soft delete)."""
    result = await db.execute(
        select(EmailTemplate).where(EmailTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email template not found"
        )

    template.is_active = False
    await db.commit()

    logger.info(
        "Email template deactivated",
        template_id=template_id,
        user_id=current_user.id
    )


# Queue Management Endpoints
@router.get("/queue/", response_model=List[EmailQueueResponse])
async def get_email_queue(
    status: Optional[EmailStatus] = Query(None),
    user_id: Optional[str] = Query(None),
    booking_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """
    Get email queue entries with optional filtering.

    - **status**: Filter by email status
    - **user_id**: Filter by user ID
    - **booking_id**: Filter by booking ID
    - **skip**: Number of entries to skip
    - **limit**: Number of entries to return
    """
    query = select(EmailQueue)

    conditions = []
    if status:
        conditions.append(EmailQueue.status == status)
    if user_id:
        conditions.append(EmailQueue.user_id == user_id)
    if booking_id:
        conditions.append(EmailQueue.booking_id == booking_id)

    if conditions:
        query = query.where(and_(*conditions))

    query = query.order_by(desc(EmailQueue.created_at)).offset(skip).limit(limit)

    result = await db.execute(query)
    queue_entries = result.scalars().all()

    return queue_entries


@router.get("/queue/{queue_id}", response_model=EmailQueueResponse)
async def get_email_queue_entry(
    queue_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """Get specific email queue entry by ID."""
    result = await db.execute(
        select(EmailQueue).where(EmailQueue.id == queue_id)
    )
    queue_entry = result.scalar_one_or_none()

    if not queue_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email queue entry not found"
        )

    return queue_entry


@router.post("/queue/", response_model=EmailQueueResponse, status_code=status.HTTP_201_CREATED)
async def queue_email(
    email_data: EmailQueueCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """Queue email for sending."""
    try:
        queue_entry = await email_service.queue_email(
            to_email=email_data.to_email,
            subject=email_data.subject,
            template_type=email_data.template_type,
            template_variables=email_data.template_variables,
            html_content=email_data.html_content,
            text_content=email_data.text_content,
            to_name=email_data.to_name,
            from_email=email_data.from_email,
            from_name=email_data.from_name,
            user_id=email_data.user_id,
            booking_id=email_data.booking_id,
            scheduled_at=email_data.scheduled_at,
            session=db
        )

        logger.info(
            "Email queued via API",
            queue_id=queue_entry.id,
            to_email=email_data.to_email,
            user_id=current_user.id
        )

        return queue_entry

    except Exception as e:
        logger.error(
            "Failed to queue email",
            error=str(e),
            to_email=email_data.to_email,
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to queue email"
        )


@router.post("/queue/{queue_id}/retry", response_model=EmailQueueResponse)
async def retry_email(
    queue_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """Retry failed email."""
    result = await db.execute(
        select(EmailQueue).where(EmailQueue.id == queue_id)
    )
    queue_entry = result.scalar_one_or_none()

    if not queue_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email queue entry not found"
        )

    if not queue_entry.can_retry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email cannot be retried"
        )

    # Reset status and schedule for immediate sending
    queue_entry.status = EmailStatus.QUEUED
    queue_entry.scheduled_at = datetime.utcnow()
    queue_entry.error_message = None

    await db.commit()
    await db.refresh(queue_entry)

    logger.info(
        "Email retry scheduled",
        queue_id=queue_id,
        user_id=current_user.id
    )

    return queue_entry


@router.get("/queue/stats", response_model=QueueStatsResponse)
async def get_queue_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """Get email queue statistics."""
    # Count by status
    status_counts_result = await db.execute(
        select(
            EmailQueue.status,
            func.count(EmailQueue.id).label("count")
        )
        .group_by(EmailQueue.status)
    )

    status_counts = {row[0]: row[1] for row in status_counts_result}

    # Get oldest queued email
    oldest_queued_result = await db.execute(
        select(func.min(EmailQueue.created_at))
        .where(EmailQueue.status == EmailStatus.QUEUED)
    )
    oldest_queued = oldest_queued_result.scalar()

    # Calculate processing rate (emails sent in last hour)
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    processing_rate_result = await db.execute(
        select(func.count(EmailQueue.id))
        .where(
            and_(
                EmailQueue.status == EmailStatus.SENT,
                EmailQueue.sent_at >= one_hour_ago
            )
        )
    )
    processing_rate = processing_rate_result.scalar() or 0

    return QueueStatsResponse(
        total_emails=sum(status_counts.values()),
        queued=status_counts.get(EmailStatus.QUEUED, 0),
        sending=status_counts.get(EmailStatus.SENDING, 0),
        sent=status_counts.get(EmailStatus.SENT, 0),
        failed=status_counts.get(EmailStatus.FAILED, 0),
        bounced=status_counts.get(EmailStatus.BOUNCED, 0),
        oldest_queued=oldest_queued,
        processing_rate=processing_rate / 60.0  # per minute
    )


# Direct Email Sending
@router.post("/send", status_code=status.HTTP_202_ACCEPTED)
async def send_email_immediately(
    email_data: EmailSendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """Send email immediately (queues with immediate scheduling)."""
    try:
        queue_entry = await email_service.queue_email(
            to_email=email_data.to_email,
            subject=email_data.subject,
            template_type=email_data.template_type,
            template_variables=email_data.template_variables,
            html_content=email_data.html_content,
            text_content=email_data.text_content,
            to_name=email_data.to_name,
            from_email=email_data.from_email,
            from_name=email_data.from_name,
            scheduled_at=datetime.utcnow(),  # Immediate sending
            session=db
        )

        logger.info(
            "Email scheduled for immediate sending",
            queue_id=queue_entry.id,
            to_email=email_data.to_email,
            user_id=current_user.id
        )

        return {"message": "Email queued for immediate sending", "queue_id": queue_entry.id}

    except Exception as e:
        logger.error(
            "Failed to send email immediately",
            error=str(e),
            to_email=email_data.to_email,
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send email"
        )


# Email Processing Control
@router.post("/queue/process", status_code=status.HTTP_202_ACCEPTED)
async def process_email_queue(
    batch_size: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """Manually trigger email queue processing."""
    try:
        processed_count = await email_service.process_email_queue(
            batch_size=batch_size,
            session=db
        )

        logger.info(
            "Email queue processing triggered",
            processed_count=processed_count,
            batch_size=batch_size,
            user_id=current_user.id
        )

        return {
            "message": "Email queue processing completed",
            "processed_count": processed_count
        }

    except Exception as e:
        logger.error(
            "Email queue processing failed",
            error=str(e),
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email queue processing failed"
        )


# Booking-Related Email Endpoints
@router.post("/bookings/{booking_id}/confirmation", status_code=status.HTTP_202_ACCEPTED)
async def send_booking_confirmation(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send booking confirmation email."""
    success = await email_service.send_booking_confirmation(
        booking_id=booking_id,
        session=db
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found or confirmation already sent"
        )

    logger.info(
        "Booking confirmation email sent",
        booking_id=booking_id,
        user_id=current_user.id
    )

    return {"message": "Booking confirmation email queued"}


@router.post("/bookings/{booking_id}/reminder", status_code=status.HTTP_202_ACCEPTED)
async def send_appointment_reminder(
    booking_id: str,
    hours_before: int = Query(24, ge=1, le=168),  # 1 hour to 1 week
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send appointment reminder email."""
    success = await email_service.send_appointment_reminder(
        booking_id=booking_id,
        hours_before=hours_before,
        session=db
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found or reminder already sent"
        )

    logger.info(
        "Appointment reminder email sent",
        booking_id=booking_id,
        hours_before=hours_before,
        user_id=current_user.id
    )

    return {"message": "Appointment reminder email queued"}


@router.post("/bookings/{booking_id}/cancellation", status_code=status.HTTP_202_ACCEPTED)
async def send_cancellation_notification(
    booking_id: str,
    cancelled_by_customer: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send booking cancellation notification."""
    success = await email_service.send_cancellation_notification(
        booking_id=booking_id,
        cancelled_by_customer=cancelled_by_customer,
        session=db
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )

    logger.info(
        "Cancellation notification emails sent",
        booking_id=booking_id,
        cancelled_by_customer=cancelled_by_customer,
        user_id=current_user.id
    )

    return {"message": "Cancellation notification emails queued"}
