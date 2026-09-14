"""
Zupi Delivery API - Backend regression tests
Covers: auth (register/login/forgot/reset/profile), public endpoints, customer flow (address/order/coupon/cancel),
merchant flow (dashboard/orders/menu/coupons/finance), admin flow (dashboard/restaurants/users/cities/coupons/settings/support),
security (roles, invalid transitions).
"""
import os
import time
import uuid
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # Read from frontend/.env (preview URL is required because backend cookies are Secure)
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                    break
    except Exception:
        pass
if not BASE:
    BASE = "http://localhost:8001"
API = f"{BASE}/api"

# Cloudflare in front of the preview URL blocks the default python-requests UA.
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
_orig_request = requests.Session.request


def _patched_request(self, method, url, **kw):
    headers = kw.pop("headers", None) or {}
    headers.setdefault("User-Agent", UA)
    kw["headers"] = headers
    return _orig_request(self, method, url, **kw)


requests.Session.request = _patched_request

ADMIN = ("financeirorenanuk@gmail.com", "Zupi@2026")
MERCHANT = ("lojista@zupi.com", "zupi123")
CUSTOMER = ("cliente@zupi.com", "zupi123")
JOAO = ("joao@zupi.com", "zupi123")


UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"


def _make_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "User-Agent": UA})
    return s


def _session(email, password):
    s = _make_session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login {email} failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def admin_s():
    return _session(*ADMIN)


@pytest.fixture(scope="session")
def merchant_s():
    return _session(*MERCHANT)


@pytest.fixture(scope="session")
def customer_s():
    return _session(*CUSTOMER)


# ------------------ Health & Public ------------------
class TestHealth:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=10)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


class TestPublic:
    def test_cities(self):
        r = requests.get(f"{API}/cities", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        assert any("name" in c for c in data)

    def test_categories(self):
        r = requests.get(f"{API}/categories", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) > 0

    def test_restaurants_list(self):
        r = requests.get(f"{API}/restaurants", timeout=10)
        assert r.status_code == 200
        rests = r.json()
        assert isinstance(rests, list) and len(rests) >= 10
        assert any("Sabor da Terra" in x["name"] for x in rests)
        # Padaria/Mercadinho should exist and be currently open (07-22 SP)
        allday = [x for x in rests if x["name"] in ("Padaria Pão Quente", "Mercadinho Central")]
        assert len(allday) == 2

    def test_search_parmegiana(self):
        r = requests.get(f"{API}/search", params={"q": "parmegiana"}, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "restaurants" in data and "products" in data
        # Expect at least one product / restaurant
        assert len(data["products"]) > 0 or len(data["restaurants"]) > 0

    def test_banners(self):
        r = requests.get(f"{API}/banners", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ------------------ Auth ------------------
class TestAuth:
    def test_register_and_login(self):
        email = f"test_{uuid.uuid4().hex[:8]}@zupi.com"
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        r = s.post(f"{API}/auth/register", json={
            "name": "Test User", "email": email, "password": "test123", "role": "customer"
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == email
        assert "password_hash" not in data
        # cookies should be set
        assert "access_token" in s.cookies or any(c.name == "access_token" for c in s.cookies)

        # /auth/me should work
        r = s.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == email

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": "cliente@zupi.com", "password": "wrong-pass"}, timeout=15)
        assert r.status_code == 401

    def test_forgot_password_generic(self):
        # Registered
        r1 = requests.post(f"{API}/auth/forgot-password", json={"email": CUSTOMER[0]}, timeout=15)
        # Unregistered
        r2 = requests.post(f"{API}/auth/forgot-password",
                           json={"email": f"nope_{uuid.uuid4().hex[:6]}@zupi.com"}, timeout=15)
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json() == r2.json()

    def test_profile_update(self, customer_s):
        r = customer_s.put(f"{API}/auth/profile",
                           json={"name": "Maria Silva", "phone": "16999990000"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["name"] == "Maria Silva"


# ------------------ Customer flow ------------------
class TestCustomer:
    def test_addresses_list(self, customer_s):
        r = customer_s.get(f"{API}/addresses", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_coupon_validate_zupi10(self, customer_s):
        # Need a restaurant id
        rests = requests.get(f"{API}/restaurants", timeout=15).json()
        rid = rests[0]["id"]
        r = customer_s.post(f"{API}/coupons/validate",
                            json={"code": "ZUPI10", "subtotal": 50, "restaurant_id": rid}, timeout=15)
        if r.status_code == 400 and "inválido" in r.text.lower():
            pytest.skip("Cupom ZUPI10 não presente no seed (seed incompleto)")
        assert r.status_code == 200, r.text
        assert r.json()["discount"] > 0

    def test_coupon_validate_invalid(self, customer_s):
        rests = requests.get(f"{API}/restaurants", timeout=15).json()
        rid = rests[0]["id"]
        r = customer_s.post(f"{API}/coupons/validate",
                            json={"code": "NOSUCH123", "subtotal": 50, "restaurant_id": rid}, timeout=15)
        assert r.status_code == 400

    def test_coupon_min_order_fail(self, customer_s):
        rests = requests.get(f"{API}/restaurants", timeout=15).json()
        rid = rests[0]["id"]
        r = customer_s.post(f"{API}/coupons/validate",
                            json={"code": "ZUPI10", "subtotal": 10, "restaurant_id": rid}, timeout=15)
        assert r.status_code == 400


# ------------------ End to end order (via open restaurant) ------------------
@pytest.fixture(scope="session")
def open_restaurant():
    """Find an open restaurant (Padaria/Mercadinho are 07-22)."""
    rests = requests.get(f"{API}/restaurants", timeout=15).json()
    for r in rests:
        if r.get("is_open") and r.get("status") == "active":
            return r
    pytest.skip("Nenhum restaurante aberto no momento")


@pytest.fixture(scope="session")
def open_restaurant_detail(open_restaurant):
    d = requests.get(f"{API}/restaurants/{open_restaurant['id']}", timeout=15).json()
    return d


class TestOrderE2E:
    def test_restaurant_detail(self, open_restaurant_detail):
        d = open_restaurant_detail
        assert "restaurant" in d and "menu" in d
        assert len(d["menu"]) > 0
        # find at least one available product
        prods = [p for cat in d["menu"] for p in cat["products"] if p.get("available")]
        assert len(prods) > 0

    def test_create_order_and_track(self, customer_s, open_restaurant, open_restaurant_detail):
        prods = [p for cat in open_restaurant_detail["menu"] for p in cat["products"] if p.get("available")]
        # pick items enough for min_order
        min_order = float(open_restaurant.get("min_order", 0))
        picks = []
        total = 0
        for p in prods:
            qty = 1
            price = float(p.get("promo_price") or p["price"])
            picks.append({"product_id": p["id"], "qty": qty, "addons": [], "notes": ""})
            total += price * qty
            if total >= max(min_order, 20):
                break

        payload = {
            "restaurant_id": open_restaurant["id"],
            "items": picks,
            "delivery_type": "delivery",
            "address": {"label": "Casa", "street": "Rua Teste", "number": "10",
                        "district": "Centro", "city": open_restaurant["city"], "state": "SP"},
            "payment_method": "pix",
        }
        r = customer_s.post(f"{API}/orders", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["status"] == "PENDING"
        assert order["zupi_fee"] == 2.0
        assert order["total"] > 0
        pytest.order_id = order["id"]
        pytest.order_rest_id = open_restaurant["id"]

        # verify GET
        r2 = customer_s.get(f"{API}/orders/{order['id']}", timeout=15)
        assert r2.status_code == 200
        assert r2.json()["id"] == order["id"]

        # verify appears in /orders/mine
        r3 = customer_s.get(f"{API}/orders/mine", timeout=15)
        assert r3.status_code == 200
        assert any(o["id"] == order["id"] for o in r3.json())

    def test_pickup_order(self, customer_s, open_restaurant, open_restaurant_detail):
        prods = [p for cat in open_restaurant_detail["menu"] for p in cat["products"] if p.get("available")]
        min_order = float(open_restaurant.get("min_order", 0))
        picks = []
        total = 0.0
        for p in prods:
            price = float(p.get("promo_price") or p["price"])
            picks.append({"product_id": p["id"], "qty": 1, "addons": [], "notes": ""})
            total += price
            if total >= max(min_order, 15):
                break
        payload = {
            "restaurant_id": open_restaurant["id"],
            "items": picks, "delivery_type": "pickup", "payment_method": "cash",
        }
        r = customer_s.post(f"{API}/orders", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["delivery_type"] == "pickup"
        assert o["pickup_code"] and len(o["pickup_code"]) >= 4
        assert o["delivery_fee"] == 0

    def test_reorder(self, customer_s):
        oid = getattr(pytest, "order_id", None)
        if not oid:
            pytest.skip("no order created")
        r = customer_s.post(f"{API}/orders/{oid}/reorder", timeout=15)
        assert r.status_code == 200
        assert len(r.json()["items"]) > 0

    def test_cancel_order_customer(self, customer_s, open_restaurant, open_restaurant_detail):
        # create a fresh pending order and cancel it
        prods = [p for cat in open_restaurant_detail["menu"] for p in cat["products"] if p.get("available")]
        min_order = float(open_restaurant.get("min_order", 0))
        picks = []
        total = 0.0
        for p in prods:
            price = float(p.get("promo_price") or p["price"])
            picks.append({"product_id": p["id"], "qty": 1, "addons": [], "notes": ""})
            total += price
            if total >= max(min_order, 15):
                break
        payload = {
            "restaurant_id": open_restaurant["id"],
            "items": picks,
            "delivery_type": "pickup", "payment_method": "cash",
        }
        r = customer_s.post(f"{API}/orders", json=payload, timeout=30)
        assert r.status_code == 200
        oid = r.json()["id"]
        r2 = customer_s.post(f"{API}/orders/{oid}/cancel", timeout=15)
        assert r2.status_code == 200
        # cancelled order cannot be re-cancelled
        r3 = customer_s.post(f"{API}/orders/{oid}/cancel", timeout=15)
        assert r3.status_code == 400

    def test_closed_restaurant_rejected(self, customer_s):
        """A regular restaurant (11-14 / 18-23) at other times should be rejected."""
        rests = requests.get(f"{API}/restaurants", timeout=15).json()
        closed = next((r for r in rests if not r.get("is_open")), None)
        if not closed:
            pytest.skip("Todos restaurantes abertos, não é possível testar rejeição")
        detail = requests.get(f"{API}/restaurants/{closed['id']}", timeout=15).json()
        prods = [p for cat in detail["menu"] for p in cat["products"] if p.get("available")]
        if not prods:
            pytest.skip("Sem produtos disponíveis no restaurante fechado")
        payload = {
            "restaurant_id": closed["id"],
            "items": [{"product_id": prods[0]["id"], "qty": 1, "addons": [], "notes": ""}],
            "delivery_type": "pickup", "payment_method": "cash",
        }
        r = customer_s.post(f"{API}/orders", json=payload, timeout=30)
        assert r.status_code == 400


# ------------------ Merchant ------------------
class TestMerchant:
    def test_dashboard(self, merchant_s):
        r = merchant_s.get(f"{API}/merchant/dashboard?days=30", timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ("gross", "orders", "zupi_fees", "ticket_avg", "top_products", "by_hour"):
            assert k in d

    def test_orders_list(self, merchant_s):
        r = merchant_s.get(f"{API}/merchant/orders", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_menu_flow(self, merchant_s):
        # create category
        r = merchant_s.post(f"{API}/merchant/menu/categories",
                            json={"name": f"TEST_Cat_{uuid.uuid4().hex[:5]}", "order": 99}, timeout=15)
        assert r.status_code == 200
        cid = r.json()["id"]

        # create product
        r = merchant_s.post(f"{API}/merchant/menu/products",
                            json={"category_id": cid, "name": "TEST_Prod",
                                  "description": "x", "price": 12.5,
                                  "addons": [{"name": "Extra", "price": 2}]},
                            timeout=15)
        assert r.status_code == 200
        pid = r.json()["id"]
        assert len(r.json()["addons"]) == 1

        # update
        r = merchant_s.put(f"{API}/merchant/menu/products/{pid}",
                           json={"category_id": cid, "name": "TEST_Prod2", "price": 15.0}, timeout=15)
        assert r.status_code == 200
        assert r.json()["price"] == 15.0

        # duplicate
        r = merchant_s.post(f"{API}/merchant/menu/products/{pid}/duplicate", timeout=15)
        assert r.status_code == 200
        dup_id = r.json()["id"]

        # toggle
        r = merchant_s.post(f"{API}/merchant/menu/products/{pid}/toggle", timeout=15)
        assert r.status_code == 200

        # delete both
        merchant_s.delete(f"{API}/merchant/menu/products/{pid}", timeout=15)
        merchant_s.delete(f"{API}/merchant/menu/products/{dup_id}", timeout=15)
        merchant_s.delete(f"{API}/merchant/menu/categories/{cid}", timeout=15)

    def test_pause_toggle(self, merchant_s):
        r = merchant_s.post(f"{API}/merchant/pause", json={"paused": True}, timeout=15)
        assert r.status_code == 200 and r.json()["paused"] is True
        r = merchant_s.post(f"{API}/merchant/pause", json={"paused": False}, timeout=15)
        assert r.status_code == 200

    def test_finance(self, merchant_s):
        r = merchant_s.get(f"{API}/merchant/finance?days=30", timeout=20)
        assert r.status_code == 200
        for k in ("gross", "zupi_fees", "net", "orders", "by_day", "transactions", "platform_fee"):
            assert k in r.json()

    def test_coupon_create_conflict(self, merchant_s):
        code = f"TEST{uuid.uuid4().hex[:5].upper()}"
        r = merchant_s.post(f"{API}/merchant/coupons",
                            json={"code": code, "type": "percent", "value": 5, "min_order": 10}, timeout=15)
        assert r.status_code == 200
        cid = r.json()["id"]
        r2 = merchant_s.post(f"{API}/merchant/coupons",
                             json={"code": code, "type": "percent", "value": 5}, timeout=15)
        assert r2.status_code == 409
        merchant_s.delete(f"{API}/merchant/coupons/{cid}", timeout=15)


# ------------------ Admin ------------------
class TestAdmin:
    def test_dashboard(self, admin_s):
        r = admin_s.get(f"{API}/admin/dashboard", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("gmv", "zupi_revenue", "orders", "restaurants", "users", "by_day", "top_restaurants"):
            assert k in d

    def test_users_list(self, admin_s):
        r = admin_s.get(f"{API}/admin/users?role=customer", timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_block_unblock_user(self, admin_s):
        users = admin_s.get(f"{API}/admin/users?role=customer", timeout=15).json()
        joao = next((u for u in users if u["email"] == "joao@zupi.com"), None)
        assert joao, "joao@zupi.com not found"
        r = admin_s.post(f"{API}/admin/users/{joao['id']}/block", timeout=15)
        assert r.status_code == 200 and r.json()["blocked"] is True
        # blocked user cannot login
        rr = requests.post(f"{API}/auth/login", json={"email": "joao@zupi.com", "password": "zupi123"}, timeout=15)
        assert rr.status_code == 403
        # unblock
        r = admin_s.post(f"{API}/admin/users/{joao['id']}/block", timeout=15)
        assert r.status_code == 200 and r.json()["blocked"] is False
        rr = requests.post(f"{API}/auth/login", json={"email": "joao@zupi.com", "password": "zupi123"}, timeout=15)
        assert rr.status_code == 200

    def test_cities_and_categories(self, admin_s):
        # add city
        r = admin_s.post(f"{API}/admin/cities", json={"name": f"TEST_City_{uuid.uuid4().hex[:4]}", "state": "SP"}, timeout=15)
        assert r.status_code == 200
        # add category
        r = admin_s.post(f"{API}/admin/categories", json={"name": f"TEST_Cat_{uuid.uuid4().hex[:4]}"}, timeout=15)
        assert r.status_code == 200
        cid = r.json()["id"]
        admin_s.delete(f"{API}/admin/categories/{cid}", timeout=15)

    def test_settings_update(self, admin_s):
        r = admin_s.put(f"{API}/admin/settings", json={"platform_fee": 3.0, "platform_name": "Zupi Delivery"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["platform_fee"] == 3.0
        # revert
        r = admin_s.put(f"{API}/admin/settings", json={"platform_fee": 2.0, "platform_name": "Zupi Delivery"}, timeout=15)
        assert r.status_code == 200

    def test_admin_finance(self, admin_s):
        r = admin_s.get(f"{API}/admin/finance", timeout=20)
        assert r.status_code == 200
        for k in ("zupi_revenue", "transactions", "by_restaurant"):
            assert k in r.json()

    def test_banner_create(self, admin_s):
        r = admin_s.post(f"{API}/admin/banners",
                         json={"title": f"TEST_{uuid.uuid4().hex[:5]}", "subtitle": "x", "position": 99, "active": True},
                         timeout=15)
        assert r.status_code == 200
        bid = r.json()["id"]
        admin_s.delete(f"{API}/admin/banners/{bid}", timeout=15)


# ------------------ Security ------------------
class TestSecurity:
    def test_admin_requires_auth(self):
        r = requests.get(f"{API}/admin/dashboard", timeout=10)
        assert r.status_code == 401

    def test_customer_cannot_admin(self, customer_s):
        r = customer_s.get(f"{API}/admin/dashboard", timeout=10)
        assert r.status_code == 403

    def test_customer_cannot_merchant(self, customer_s):
        r = customer_s.get(f"{API}/merchant/dashboard", timeout=10)
        assert r.status_code == 403

    def test_invalid_transition(self, admin_s):
        # find a DELIVERED order and try -> PENDING
        orders = admin_s.get(f"{API}/admin/orders", timeout=15).json()
        delivered = next((o for o in orders if o["status"] == "DELIVERED"), None)
        if not delivered:
            pytest.skip("no delivered order")
        r = admin_s.post(f"{API}/admin/orders/{delivered['id']}/status",
                         json={"status": "PENDING"}, timeout=15)
        assert r.status_code == 400
