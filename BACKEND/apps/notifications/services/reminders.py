from datetime import date, timedelta

from django.conf import settings
from django.db import IntegrityError
from django.db.models import Q
from django.utils import timezone

from apps.leases.models import Lease, LeaseStatus
from apps.payments.models import Payment, PaymentStatus

from ..models import (
    NotificationChannel,
    NotificationLog,
    NotificationStatus,
    TenantNotificationPreference,
)
from .email import EmailService
from .sms import SMSService
from .whatsapp import WhatsAppService


def _parse_reminder_days(raw=None):
    if raw is None:
        raw = getattr(settings, "RENT_REMINDER_DAYS", [-3, 0, 3])
    if isinstance(raw, str):
        raw = [item.strip() for item in raw.split(",") if item.strip()]
    days = []
    for item in raw:
        try:
            days.append(int(item))
        except (TypeError, ValueError):
            continue
    return sorted(set(days))


def _get_month_due_date(base_date, due_day):
    if due_day < 1:
        due_day = 1
    next_month = base_date.replace(day=28) + timedelta(days=4)
    last_day = (next_month.replace(day=1) - timedelta(days=1)).day
    return base_date.replace(day=min(due_day, last_day))


def _has_payment_for_month(lease, due_date):
    month_start = due_date.replace(day=1)
    month_end = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return Payment.objects.filter(
        lease=lease,
        status=PaymentStatus.PAID,
        paid_at__date__gte=month_start,
        paid_at__date__lt=month_end,
    ).exists()


def _build_message(template_key, lease, due_date, offset):
    amount = lease.rent_amount
    property_title = lease.property.title
    if template_key == "rent_due_soon":
        return (
            f"Rappel: votre loyer de {amount} XOF pour {property_title} "
            f"est du le {due_date:%d/%m/%Y}."
        )
    if template_key == "rent_due_today":
        return (
            f"Votre loyer de {amount} XOF pour {property_title} "
            f"est du aujourd'hui ({due_date:%d/%m/%Y})."
        )
    return (
        f"Retard de loyer ({offset}j): {amount} XOF pour {property_title}. "
        f"Date d'echeance: {due_date:%d/%m/%Y}."
    )


def send_rent_reminders(today=None):
    today = today or timezone.localdate()
    reminder_days = _parse_reminder_days()
    base_channels = getattr(
        settings, "NOTIFICATION_CHANNELS", ["email", "sms", "whatsapp"]
    )
    if isinstance(base_channels, str):
        base_channels = [c.strip() for c in base_channels.split(",") if c.strip()]

    email_service = EmailService()
    sms_service = SMSService()
    whatsapp_service = WhatsAppService()

    leases = Lease.objects.filter(status=LeaseStatus.ACTIVE).select_related(
        "agency", "property", "tenant"
    )

    for lease in leases:
        if lease.start_date and lease.start_date > today:
            continue
        due_date = _get_month_due_date(today, lease.start_date.day)
        if _has_payment_for_month(lease, due_date):
            continue

        preference = None
        if lease.tenant_id:
            preference = TenantNotificationPreference.objects.filter(
                tenant_id=lease.tenant_id
            ).first()

        reminder_days = _parse_reminder_days(
            preference.remind_days if preference and preference.remind_days else None
        )

        lease_channels = list(base_channels)
        if preference:
            if not preference.allow_email and NotificationChannel.EMAIL in lease_channels:
                lease_channels = [c for c in lease_channels if c != NotificationChannel.EMAIL]
            if not preference.allow_sms and NotificationChannel.SMS in lease_channels:
                lease_channels = [c for c in lease_channels if c != NotificationChannel.SMS]
            if not preference.allow_whatsapp and NotificationChannel.WHATSAPP in lease_channels:
                lease_channels = [c for c in lease_channels if c != NotificationChannel.WHATSAPP]

        for offset in reminder_days:
            scheduled_for = due_date + timedelta(days=offset)
            if scheduled_for != today:
                continue

            if offset < 0:
                template_key = "rent_due_soon"
            elif offset == 0:
                template_key = "rent_due_today"
            else:
                template_key = "rent_overdue"

            message = _build_message(template_key, lease, due_date, offset)
            tenant_email = lease.tenant_email or (
                lease.tenant.email if lease.tenant else ""
            )
            tenant_phone = lease.tenant_phone or (
                lease.tenant.phone_number if lease.tenant else ""
            )

            for channel in lease_channels:
                if channel == NotificationChannel.EMAIL and not tenant_email:
                    continue
                if channel in (NotificationChannel.SMS, NotificationChannel.WHATSAPP) and not tenant_phone:
                    continue
                if (
                    channel == NotificationChannel.WHATSAPP
                    and preference
                    and not preference.whatsapp_verified
                ):
                    continue

                try:
                    log = NotificationLog.objects.create(
                        agency=lease.agency,
                        lease=lease,
                        tenant=lease.tenant,
                        channel=channel,
                        template_key=template_key,
                        scheduled_for=scheduled_for,
                        message=message,
                    )
                except IntegrityError:
                    continue

                try:
                    if channel == NotificationChannel.EMAIL:
                        email_service.send_email(
                            subject="Rappel de loyer",
                            to=tenant_email,
                            template_txt="email/rent_reminder.txt",
                            template_html="email/rent_reminder.html",
                            context={
                                "tenant_name": lease.tenant_name,
                                "amount": lease.rent_amount,
                                "currency": "XOF",
                                "property_title": lease.property.title,
                                "due_date": due_date,
                                "agency_name": lease.agency.name,
                                "message": message,
                            },
                        )
                    elif channel == NotificationChannel.SMS:
                        sms_service.send_sms(tenant_phone, message)
                    elif channel == NotificationChannel.WHATSAPP:
                        if (
                            getattr(settings, "WHATSAPP_USE_TEMPLATE", False)
                            and settings.WHATSAPP_TEMPLATE_NAME
                        ):
                            components = {
                                "body": {
                                    "type": "text",
                                    "text": message,
                                    "example": {"body_text": [[message]]},
                                }
                            }
                            whatsapp_service.send_template(
                                tenant_phone,
                                template_name=settings.WHATSAPP_TEMPLATE_NAME,
                                components=components,
                                language=settings.WHATSAPP_TEMPLATE_LANGUAGE,
                                category=settings.WHATSAPP_TEMPLATE_CATEGORY,
                            )
                        else:
                            whatsapp_service.send_message(tenant_phone, message)

                    log.status = NotificationStatus.SENT
                    log.sent_at = timezone.now()
                    log.save(update_fields=["status", "sent_at"])
                except Exception as exc:
                    log.status = NotificationStatus.FAILED
                    log.error_message = str(exc)
                    log.save(update_fields=["status", "error_message"])


def send_manual_reminder(lease, channels=None, message=None, template_key="manual_reminder"):
    if channels is None:
        channels = getattr(settings, "NOTIFICATION_CHANNELS", ["email", "sms", "whatsapp"])
    if isinstance(channels, str):
        channels = [c.strip() for c in channels.split(",") if c.strip()]

    tenant_email = lease.tenant_email or (lease.tenant.email if lease.tenant else "")
    tenant_phone = lease.tenant_phone or (lease.tenant.phone_number if lease.tenant else "")

    if not message:
        message = (
            f"Rappel de loyer: {lease.rent_amount} XOF pour {lease.property.title}. "
            f"Merci de regler au plus vite."
        )

    email_service = EmailService()
    sms_service = SMSService()
    whatsapp_service = WhatsAppService()

    results = {"sent": 0, "failed": 0, "skipped": 0}
    preference = None
    if lease.tenant_id:
        preference = TenantNotificationPreference.objects.filter(
            tenant_id=lease.tenant_id
        ).first()

    for channel in channels:
        if channel == NotificationChannel.EMAIL and not tenant_email:
            results["skipped"] += 1
            continue
        if channel in (NotificationChannel.SMS, NotificationChannel.WHATSAPP) and not tenant_phone:
            results["skipped"] += 1
            continue
        if preference:
            if channel == NotificationChannel.EMAIL and not preference.allow_email:
                results["skipped"] += 1
                continue
            if channel == NotificationChannel.SMS and not preference.allow_sms:
                results["skipped"] += 1
                continue
            if channel == NotificationChannel.WHATSAPP and not preference.allow_whatsapp:
                results["skipped"] += 1
                continue
        if (
            channel == NotificationChannel.WHATSAPP
            and preference
            and not preference.whatsapp_verified
        ):
            results["skipped"] += 1
            continue

        try:
            log = NotificationLog.objects.create(
                agency=lease.agency,
                lease=lease,
                tenant=lease.tenant,
                channel=channel,
                template_key=template_key,
                scheduled_for=timezone.localdate(),
                message=message,
            )
        except IntegrityError:
            results["skipped"] += 1
            continue

        try:
            if channel == NotificationChannel.EMAIL:
                email_service.send_email(
                    subject="Rappel de loyer",
                    to=tenant_email,
                    template_txt="email/rent_reminder.txt",
                    template_html="email/rent_reminder.html",
                    context={
                        "tenant_name": lease.tenant_name,
                        "amount": lease.rent_amount,
                        "currency": "XOF",
                        "property_title": lease.property.title,
                        "due_date": timezone.localdate(),
                        "agency_name": lease.agency.name,
                        "message": message,
                    },
                )
            elif channel == NotificationChannel.SMS:
                sms_service.send_sms(tenant_phone, message)
            elif channel == NotificationChannel.WHATSAPP:
                if (
                    getattr(settings, "WHATSAPP_USE_TEMPLATE", False)
                    and settings.WHATSAPP_TEMPLATE_NAME
                ):
                    components = {
                        "body": {
                            "type": "text",
                            "text": message,
                            "example": {"body_text": [[message]]},
                        }
                    }
                    whatsapp_service.send_template(
                        tenant_phone,
                        template_name=settings.WHATSAPP_TEMPLATE_NAME,
                        components=components,
                        language=settings.WHATSAPP_TEMPLATE_LANGUAGE,
                        category=settings.WHATSAPP_TEMPLATE_CATEGORY,
                    )
                else:
                    whatsapp_service.send_message(tenant_phone, message)

            log.status = NotificationStatus.SENT
            log.sent_at = timezone.now()
            log.save(update_fields=["status", "sent_at"])
            results["sent"] += 1
        except Exception as exc:
            log.status = NotificationStatus.FAILED
            log.error_message = str(exc)
            log.save(update_fields=["status", "error_message"])
            results["failed"] += 1

    return results


def send_bulk_reminders(
    agency,
    today=None,
    channels=None,
    message=None,
    due_date=None,
    overdue_min_days=None,
    overdue_max_days=None,
    only_overdue=False,
):
    today = today or timezone.localdate()
    leases = Lease.objects.filter(
        agency=agency, status=LeaseStatus.ACTIVE
    ).select_related("property", "tenant", "agency")

    sent = 0
    failed = 0
    skipped = 0

    for lease in leases:
        if lease.start_date and lease.start_date > today:
            continue

        current_due_date = _get_month_due_date(today, lease.start_date.day)
        if due_date and current_due_date != due_date:
            continue

        if _has_payment_for_month(lease, current_due_date):
            continue

        overdue_days = (today - current_due_date).days
        if only_overdue and overdue_days <= 0:
            continue
        if overdue_min_days is not None and overdue_days < overdue_min_days:
            continue
        if overdue_max_days is not None and overdue_days > overdue_max_days:
            continue

        msg = message
        if msg:
            try:
                msg = msg.format(
                    amount=lease.rent_amount,
                    property_title=lease.property.title,
                    due_date=current_due_date,
                    tenant_name=lease.tenant_name,
                    overdue_days=overdue_days,
                )
            except Exception:
                pass

        result = send_manual_reminder(
            lease,
            channels=channels,
            message=msg,
            template_key="bulk_reminder",
        )
        sent += result["sent"]
        failed += result["failed"]
        skipped += result["skipped"]

    return {"sent": sent, "failed": failed, "skipped": skipped}
