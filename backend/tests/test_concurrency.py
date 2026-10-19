"""Concurrent offer acceptance — exactly one winner."""

from __future__ import annotations

import threading
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import create_engine, func, select, update
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.core.db import reset_engine
from app.models import DriverAvailability, TripAssignment
from app.services.auth import create_user
from app.services.booking import create_booking
from app.services.dispatch import (
    DispatchError,
    accept_offer,
    dispatch_booking,
    get_or_create_driver_profile,
    set_availability,
)
from app.services.seed import seed_rbac_catalogue


@pytest.mark.db
def test_concurrent_accept_one_winner(db_available: bool) -> None:
    if not db_available:
        pytest.skip("PostgreSQL not reachable")

    get_settings.cache_clear()
    reset_engine()
    settings = get_settings()
    url = settings.sqlalchemy_url(prefer_host=True)
    engine = create_engine(url, pool_pre_ping=True, pool_size=8)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    setup = Session()
    try:
        seed_rbac_catalogue(setup)
        setup.execute(update(DriverAvailability).values(is_online=False))
        setup.commit()
        customer = create_user(
            setup,
            email=f"c_{uuid.uuid4().hex[:8]}@example.com",
            password="CorrectHorseBattery1!",
            display_name="Cust",
            role_codes=["customer"],
        )
        d1 = create_user(
            setup,
            email=f"d1_{uuid.uuid4().hex[:8]}@example.com",
            password="CorrectHorseBattery1!",
            display_name="D1",
            role_codes=["driver"],
        )
        d2 = create_user(
            setup,
            email=f"d2_{uuid.uuid4().hex[:8]}@example.com",
            password="CorrectHorseBattery1!",
            display_name="D2",
            role_codes=["driver"],
        )
        p1 = get_or_create_driver_profile(setup, d1.id)
        p2 = get_or_create_driver_profile(setup, d2.id)
        set_availability(setup, p1, is_online=True, lat=17.385, lon=78.4867)
        set_availability(setup, p2, is_online=True, lat=17.386, lon=78.4870)

        booking, _ = create_booking(
            setup,
            customer_id=customer.id,
            pickup_lat=17.385,
            pickup_lon=78.4867,
            drop_lat=17.448,
            drop_lon=78.391,
            vehicle_type="Cab",
            idempotency_key=f"idem-{uuid.uuid4()}",
        )
        dispatch_booking(setup, booking.id)

        from app.models import DriverOffer

        offers = list(
            setup.scalars(
                select(DriverOffer).where(DriverOffer.booking_id == booking.id)
            ).all()
        )
        assert len(offers) >= 2
        offer_by_driver = {o.driver_profile_id: o.id for o in offers}
        oid1 = offer_by_driver[p1.id]
        oid2 = offer_by_driver[p2.id]
        booking_id = booking.id
    finally:
        setup.close()

    results: list[str] = []
    barrier = threading.Barrier(2)

    def attempt(offer_id, driver_profile_id: uuid.UUID) -> None:
        db = Session()
        try:
            barrier.wait(timeout=10)
            accept_offer(db, offer_id, driver_profile_id=driver_profile_id)
            results.append("won")
        except DispatchError as exc:
            results.append(exc.code)
        except Exception as exc:  # noqa: BLE001
            results.append(type(exc).__name__)
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        f1 = pool.submit(attempt, oid1, p1.id)
        f2 = pool.submit(attempt, oid2, p2.id)
        f1.result(timeout=30)
        f2.result(timeout=30)

    assert results.count("won") == 1, results
    assert "already_assigned" in results or results.count("won") == 1

    verify = Session()
    try:
        count = verify.scalar(
            select(func.count())
            .select_from(TripAssignment)
            .where(TripAssignment.booking_id == booking_id)
        )
        assert count == 1
    finally:
        verify.close()
        engine.dispose()


@pytest.mark.db
def test_duplicate_accept_same_driver(
    db_available: bool, make_user, db_session
) -> None:
    if not db_available or db_session is None:
        pytest.skip("PostgreSQL not reachable")
    db_session.execute(update(DriverAvailability).values(is_online=False))
    db_session.commit()
    customer, _ = make_user(role="customer")
    driver, _ = make_user(role="driver")
    profile = get_or_create_driver_profile(db_session, driver.id)
    set_availability(db_session, profile, is_online=True, lat=17.385, lon=78.4867)
    booking, _ = create_booking(
        db_session,
        customer_id=customer.id,
        pickup_lat=17.385,
        pickup_lon=78.4867,
        drop_lat=17.448,
        drop_lon=78.391,
        vehicle_type="Cab",
        idempotency_key=f"idem-{uuid.uuid4()}",
    )
    dispatch_booking(db_session, booking.id)
    from app.models import DriverOffer

    offer = db_session.scalar(
        select(DriverOffer).where(
            DriverOffer.booking_id == booking.id,
            DriverOffer.driver_profile_id == profile.id,
        )
    )
    assert offer is not None
    accept_offer(db_session, offer.id, driver_profile_id=profile.id)
    with pytest.raises(DispatchError) as exc:
        accept_offer(db_session, offer.id, driver_profile_id=profile.id)
    assert exc.value.code in ("offer_not_pending", "already_assigned", "booking_not_offerable")
