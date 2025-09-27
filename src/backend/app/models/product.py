"""
Product and product category models.
"""
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import BaseModel


class ProductCategory(Base, BaseModel):
    """Product category model."""

    __tablename__ = "product_categories"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    parent_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("product_categories.id"),
        nullable=True,
    )
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Self-referential relationship for hierarchical categories
    parent: Mapped[Optional["ProductCategory"]] = relationship(
        "ProductCategory", remote_side="ProductCategory.id", back_populates="children"
    )
    children: Mapped[List["ProductCategory"]] = relationship(
        "ProductCategory", back_populates="parent"
    )

    # Products in this category
    products: Mapped[List["Product"]] = relationship(
        "Product", back_populates="category"
    )

    def __repr__(self) -> str:
        return f"<ProductCategory(id={self.id}, name={self.name})>"


class Product(Base, BaseModel):
    """Product model."""

    __tablename__ = "products"

    category_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("product_categories.id"),
        nullable=True,
    )

    # Basic information
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sku: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    cost_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)

    # Inventory
    stock_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    track_inventory: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Product attributes
    brand: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    size: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    weight_grams: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    ingredients: Mapped[Optional[List[str]]] = mapped_column(ARRAY(Text), nullable=True)

    # Visibility
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # SEO
    slug: Mapped[Optional[str]] = mapped_column(String(200), unique=True, nullable=True)

    # Relationships
    category: Mapped[Optional["ProductCategory"]] = relationship(
        "ProductCategory", back_populates="products"
    )

    booking_products: Mapped[List["BookingProduct"]] = relationship(
        "BookingProduct", back_populates="product"
    )

    @property
    def is_in_stock(self) -> bool:
        """Check if product is in stock."""
        if not self.track_inventory:
            return True
        return self.stock_quantity > 0

    @property
    def is_low_stock(self) -> bool:
        """Check if product is low on stock."""
        if not self.track_inventory:
            return False
        return self.stock_quantity <= self.low_stock_threshold

    @property
    def profit_margin(self) -> Optional[Decimal]:
        """Calculate profit margin percentage."""
        if self.cost_price and self.cost_price > 0:
            return ((self.price - self.cost_price) / self.cost_price) * 100
        return None

    @property
    def price_formatted(self) -> str:
        """Get formatted price string."""
        return f"{self.price:.2f} DKK"

    def reduce_stock(self, quantity: int) -> bool:
        """
        Reduce stock quantity.

        Args:
            quantity: Amount to reduce

        Returns:
            bool: True if successful, False if insufficient stock
        """
        if not self.track_inventory:
            return True

        if self.stock_quantity >= quantity:
            self.stock_quantity -= quantity
            return True
        return False

    def increase_stock(self, quantity: int) -> None:
        """
        Increase stock quantity.

        Args:
            quantity: Amount to increase
        """
        self.stock_quantity += quantity

    def __repr__(self) -> str:
        return f"<Product(id={self.id}, name={self.name}, price={self.price})>"