from enum import Enum


class UserRole(str, Enum):
    REQUESTER = "REQUESTER"
    AGENT = "AGENT"
    SUPERVISOR = "SUPERVISOR"
    ADMIN = "ADMIN"


class UserStatus(str, Enum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class TicketStatus(str, Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"


class TicketPriority(str, Enum):
    P1_URGENT = "P1_URGENT"
    P2_HIGH = "P2_HIGH"
    P3_NORMAL = "P3_NORMAL"
    P4_LOW = "P4_LOW"


class TicketSource(str, Enum):
    WEB = "WEB"
    EMAIL = "EMAIL"
    ITSM = "ITSM"


class EscalationReason(str, Enum):
    FIRST_RESPONSE_AT_RISK = "FIRST_RESPONSE_AT_RISK"
    RESOLUTION_AT_RISK = "RESOLUTION_AT_RISK"
    OVERDUE = "OVERDUE"
    MANUAL = "MANUAL"


class AIValidationStatus(str, Enum):
    PENDING = "PENDING"
    VALIDATED = "VALIDATED"
    REJECTED = "REJECTED"
    CORRECTED = "CORRECTED"


class NotificationType(str, Enum):
    EMAIL = "EMAIL"
    IN_APP = "IN_APP"


class NotificationStatus(str, Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"
    READ = "READ"


class SyncStatus(str, Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"


class SyncType(str, Enum):
    IMPORT = "IMPORT"
    STATUS_UPDATE = "STATUS_UPDATE"
    MESSAGE_UPDATE = "MESSAGE_UPDATE"


class AuditEventType(str, Enum):
    STATUS_CHANGED = "STATUS_CHANGED"
    PRIORITY_CHANGED = "PRIORITY_CHANGED"
    ASSIGNEE_CHANGED = "ASSIGNEE_CHANGED"


