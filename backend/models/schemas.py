"""Pydantic v2 models for the multi-domain ad portal. Mirrored by frontend/src/lib/types.ts."""

import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Theme(BaseModel):
    bg: str = "#090B10"
    panel: str = "#121620"
    card: str = "#181E2C"
    accent: str = "#F59E0B"
    accent2: str = "#06B6D4"
    text: str = "#F1F5F9"


class PopupItem(BaseModel):
    id: str = Field(default_factory=_uuid)
    brand_name: str = ""
    logo_url: str = ""
    line1: str = ""
    line2: str = ""
    url: str = ""
    border_color: str = "#22C55E"
    col_span: int = 1
    order: int = 0


class Popup(BaseModel):
    enabled: bool = True
    title: str = "HOŞ GELDİN BONUSU"
    subtitle: str = "İlk üyeliğe özel %200 hoş geldin bonusu seni bekliyor."
    image_url: str = ""
    cta_text: str = "BONUSU AL"
    cta_url: str = "#"
    countdown_seconds: int = 60
    columns: int = 3
    items: List[PopupItem] = Field(default_factory=list)


class SiteBase(BaseModel):
    slug: str
    name: str
    domains: List[str] = Field(default_factory=list)
    title: str = ""
    tagline: str = ""
    logo_text: str = ""
    hero_image_url: str = ""
    marquee: List[str] = Field(default_factory=list)
    columns: int = 4
    theme: Theme = Field(default_factory=Theme)
    popup: Popup = Field(default_factory=Popup)
    custom_css: str = ""
    active: bool = True


class SiteCreate(SiteBase):
    pass


class SiteUpdate(BaseModel):
    slug: Optional[str] = None
    name: Optional[str] = None
    domains: Optional[List[str]] = None
    title: Optional[str] = None
    tagline: Optional[str] = None
    logo_text: Optional[str] = None
    hero_image_url: Optional[str] = None
    marquee: Optional[List[str]] = None
    columns: Optional[int] = None
    theme: Optional[Theme] = None
    popup: Optional[Popup] = None
    custom_css: Optional[str] = None
    active: Optional[bool] = None


class Site(SiteBase):
    id: str = Field(default_factory=_uuid)
    created_at: datetime = Field(default_factory=_now)


AdType = Literal["image", "html", "cta"]
BadgePosition = Literal["left", "center", "right"]
TextSize = Literal["sm", "md", "lg"]


class AdSlotBase(BaseModel):
    site_id: str
    type: AdType = "image"
    title: str = ""
    badge: str = ""
    badge_position: BadgePosition = "center"
    # Boş bırakılırsa kartın neon rengi / siyah yazı kullanılır.
    badge_bg: str = ""
    badge_text_color: str = ""
    text_size: TextSize = "md"
    description: str = ""
    line2: str = ""
    image_url: str = ""
    target_url: str = ""
    html: str = ""
    cta_text: str = ""
    border_color: str = "#22C55E"
    col_span: int = 1
    height: int = 150
    order: int = 0
    active: bool = True


class AdSlotCreate(AdSlotBase):
    pass


class AdSlotUpdate(BaseModel):
    type: Optional[AdType] = None
    title: Optional[str] = None
    badge: Optional[str] = None
    badge_position: Optional[BadgePosition] = None
    badge_bg: Optional[str] = None
    badge_text_color: Optional[str] = None
    text_size: Optional[TextSize] = None
    description: Optional[str] = None
    line2: Optional[str] = None
    image_url: Optional[str] = None
    target_url: Optional[str] = None
    html: Optional[str] = None
    cta_text: Optional[str] = None
    border_color: Optional[str] = None
    col_span: Optional[int] = None
    height: Optional[int] = None
    order: Optional[int] = None
    active: Optional[bool] = None


class AdSlot(AdSlotBase):
    id: str = Field(default_factory=_uuid)
    clicks: int = 0
    created_at: datetime = Field(default_factory=_now)


class PublicSite(BaseModel):
    site: Site
    slots: List[AdSlot]


class LoginRequest(BaseModel):
    username: str
    password: str


class AdminUser(BaseModel):
    username: str
