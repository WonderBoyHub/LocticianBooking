import pytest
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.services.email_service import email_service, DEFAULT_TEMPLATES
from app.models.enums import TemplateType


@pytest.mark.asyncio
async def test_ensure_default_templates_creates_missing(monkeypatch):
    """Missing templates should trigger creation using provided session."""

    original_templates = email_service.default_templates
    sample_templates = {
        TemplateType.MARKETING: DEFAULT_TEMPLATES[TemplateType.MARKETING],
        TemplateType.CONTACT: DEFAULT_TEMPLATES[TemplateType.CONTACT],
    }
    email_service.default_templates = sample_templates

    create_mock = AsyncMock()
    get_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(email_service, "create_template", create_mock)
    monkeypatch.setattr(email_service, "get_template", get_mock)

    session = AsyncMock()
    try:
        await email_service.ensure_default_templates(session=session)
    finally:
        email_service.default_templates = original_templates

    assert create_mock.await_count == len(sample_templates)
    for call in create_mock.await_args_list:
        kwargs = call.kwargs
        assert kwargs["session"] is session
        assert kwargs["template_type"] in sample_templates


@pytest.mark.asyncio
async def test_ensure_default_templates_skips_when_current(monkeypatch):
    """Existing templates with matching content should not be recreated."""

    original_templates = email_service.default_templates
    template_type = TemplateType.MARKETING
    template_data = DEFAULT_TEMPLATES[template_type]
    email_service.default_templates = {template_type: template_data}

    existing = SimpleNamespace(
        subject=template_data["subject"],
        html_content=template_data["html_content"],
        text_content=template_data.get("text_content"),
        version=1,
    )

    monkeypatch.setattr(email_service, "get_template", AsyncMock(return_value=existing))
    create_mock = AsyncMock()
    monkeypatch.setattr(email_service, "create_template", create_mock)

    session = AsyncMock()
    try:
        await email_service.ensure_default_templates(session=session)
    finally:
        email_service.default_templates = original_templates

    create_mock.assert_not_awaited()
