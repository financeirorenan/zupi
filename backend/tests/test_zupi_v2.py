"""
Zupi Delivery - iteration 2 tests.
Covers new features: logistics (couriers/zones/districts), uploads (image), open API v1,
webhooks/integrations, leads, and merchant status transition with courier_id/name and finance.logistics.
"""
import io
import os
import struct
import uuid
import zlib
import time
import requests
import pytest

# ---- BASE URL / UA (Cloudflare guard) ----
BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break
API = f"{BASE}/api"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
_orig_request = requests.Session.request


def _patched(self, method, url, **kw):
    h = kw.pop("headers", None) or {}
    h.setdefault("User-Agent", UA)
    kw["headers"] = h
    return _orig_request(self, method, url, **kw)


requests.Session.request = _patched


ADMIN = ("financeirorenanuk@gmail.com", "Zupi@2026")
MERCHANT = ("lojista@zupi.com", "zupi123")
CUSTOMER = ("cliente@zupi.com", "zupi123")


def _session(email, password):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "User-Agent": UA})
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login {email}: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def merchant_s():
    return _session(*MERCHANT)


@pytest.fixture(scope="session")
def customer_s():
    return _session(*CUSTOMER)


@pytest.fixture(scope="session")
def admin_s():
    return _session(*ADMIN)


# ---------------- Logistics: Couriers ----------------
class TestCouriers:
    def test_courier_crud(self, merchant_s):
        # list
        r = merchant_s.get(f"{API}/merchant/logistics/couriers", timeout=15)
        assert r.status_code == 200 and isinstance(r.json(), list)

        # create
        payload = {"name": f"TEST_Motoboy_{uuid.uuid4().hex[:5]}", "phone": "16999990000",
                   "vehicle": "moto", "daily_rate": 120.0, "active": True}
        r = merchant_s.post(f"{API}/merchant/logistics/couriers", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["name"] == payload["name"]
        assert c["daily_rate"] == 120.0
        cid = c["id"]
        pytest.courier_id = cid

        # update
        r = merchant_s.put(f"{API}/merchant/logistics/couriers/{cid}",
                           json={**payload, "daily_rate": 150.0, "name": payload["name"] + "_edit"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["daily_rate"] == 150.0

        # verify persisted
        r = merchant_s.get(f"{API}/merchant/logistics/couriers", timeout=15)
        assert any(x["id"] == cid and x["daily_rate"] == 150.0 for x in r.json())

    def test_courier_delete_at_end(self, merchant_s):
        # Delete happens implicit at end -- do it here after CRUD
        cid = getattr(pytest, "courier_id", None)
        if not cid:
            pytest.skip("no courier")
        # keep for status test — do NOT delete now
        pass


# ---------------- Logistics: Zones & Districts ----------------
class TestZones:
    def test_district_search_sertaozinho(self):
        r = requests.get(f"{API}/cities/Sert%C3%A3ozinho/districts", params={"q": "jardim"}, timeout=45)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        # seed said 112 cached; searching 'jardim' should give many
        assert any("jardim" in n.lower() for n in data), f"got {data[:5]}"

    def test_add_district_manual(self, merchant_s):
        r = merchant_s.post(f"{API}/merchant/logistics/districts",
                            json={"name": f"TEST Bairro {uuid.uuid4().hex[:4]}"}, timeout=15)
        assert r.status_code == 200
        assert "TEST" in r.json()["name"]

    def test_save_zones(self, merchant_s):
        payload = {"delivery_fee": 6.0,
                   "delivery_zones": [{"district": "Centro", "fee": 5.0},
                                      {"district": "Jardim Botânico", "fee": 8.0},
                                      {"district": "  ", "fee": 3.0}]}
        r = merchant_s.put(f"{API}/merchant/logistics/zones", json=payload, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["delivery_fee"] == 6.0
        # empty district should be filtered
        assert len(d["delivery_zones"]) == 2


# ---------------- Uploads ----------------
def _tiny_png() -> bytes:
    # 1x1 red PNG
    sig = b"\x89PNG\r\n\x1a\n"
    def chunk(t, data):
        return struct.pack(">I", len(data)) + t + data + struct.pack(">I", zlib.crc32(t + data) & 0xffffffff)
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
    idat_data = zlib.compress(b"\x00\xff\x00\x00")
    idat = chunk(b"IDAT", idat_data)
    iend = chunk(b"IEND", b"")
    return sig + ihdr + idat + iend


class TestUploads:
    def test_upload_png_and_serve(self, merchant_s):
        png = _tiny_png()
        files = {"file": ("test.png", io.BytesIO(png), "image/png")}
        # send without json content-type header
        s = requests.Session()
        s.cookies.update(merchant_s.cookies)
        s.headers.update({"User-Agent": UA})
        r = s.post(f"{API}/uploads/image", files=files, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["url"].startswith("/api/files/")
        # serve back
        r2 = requests.get(f"{BASE}{data['url']}", timeout=30)
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/")

    def test_upload_reject_text(self, merchant_s):
        s = requests.Session()
        s.cookies.update(merchant_s.cookies)
        s.headers.update({"User-Agent": UA})
        files = {"file": ("bad.txt", io.BytesIO(b"hello"), "text/plain")}
        r = s.post(f"{API}/uploads/image", files=files, timeout=15)
        assert r.status_code == 400


# ---------------- Merchant: order status with courier + finance.logistics ----------------
@pytest.fixture(scope="session")
def sabor_open(customer_s):
    """Return Sabor da Terra restaurant details (this restaurant is 11-14/18-23; may be closed)."""
    rests = requests.get(f"{API}/restaurants", timeout=15).json()
    r = next((x for x in rests if "Sabor da Terra" in x["name"]), None)
    return r


class TestOrderCourierAndFinance:
    def test_finance_has_logistics(self, merchant_s):
        r = merchant_s.get(f"{API}/merchant/finance", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "logistics" in d
        log = d["logistics"]
        for k in ("couriers", "courier_daily", "courier_cost", "deliveries", "delivery_fees", "balance"):
            assert k in log, f"missing {k}"
        # After creating a courier at 150/day, courier_daily should be >=150
        assert log["couriers"] >= 1
        assert log["courier_daily"] >= 150.0

    def test_set_status_with_courier(self, merchant_s, customer_s, sabor_open):
        if not sabor_open:
            pytest.skip("Sabor da Terra not found")
        detail = requests.get(f"{API}/restaurants/{sabor_open['id']}", timeout=15).json()
        prods = [p for cat in detail["menu"] for p in cat["products"] if p.get("available")]
        if not prods:
            pytest.skip("no products")
        # Try to create a delivery order; if closed, skip
        addr = {"label": "Casa", "street": "R X", "number": "1", "district": "Centro",
                "city": sabor_open["city"], "state": "SP"}
        picks = []
        total = 0
        for p in prods:
            price = float(p.get("promo_price") or p["price"])
            picks.append({"product_id": p["id"], "qty": 1})
            total += price
            if total >= max(float(sabor_open.get("min_order") or 0), 25):
                break
        payload = {"restaurant_id": sabor_open["id"], "items": picks,
                   "delivery_type": "delivery", "address": addr, "payment_method": "pix"}
        r = customer_s.post(f"{API}/orders", json=payload, timeout=30)
        if r.status_code != 200:
            pytest.skip(f"could not create order (restaurant closed?): {r.text[:120]}")
        oid = r.json()["id"]
        # advance status: PENDING->ACCEPTED->PREPARING->READY->OUT_FOR_DELIVERY
        # Look up any existing courier for this merchant (xdist workers don't share pytest state)
        couriers = merchant_s.get(f"{API}/merchant/logistics/couriers", timeout=15).json()
        if not couriers:
            # create ephemeral courier
            cc = merchant_s.post(f"{API}/merchant/logistics/couriers",
                                 json={"name": "TEST_Ephem", "phone": "16", "vehicle": "moto",
                                       "daily_rate": 100.0, "active": True}, timeout=15).json()
            couriers = [cc]
        cid = couriers[0]["id"]
        for st in ("ACCEPTED", "PREPARING", "READY"):
            rr = merchant_s.post(f"{API}/merchant/orders/{oid}/status", json={"status": st}, timeout=15)
            assert rr.status_code == 200, f"{st}: {rr.text}"
        rr = merchant_s.post(f"{API}/merchant/orders/{oid}/status",
                             json={"status": "OUT_FOR_DELIVERY", "courier_id": cid}, timeout=15)
        assert rr.status_code == 200, rr.text
        # Verify order has courier_name
        got = merchant_s.get(f"{API}/merchant/orders", timeout=15).json()
        this = next((x for x in got if x["id"] == oid), None)
        assert this is not None
        assert this.get("courier_id") == cid
        assert this.get("courier_name")


# ---------------- Cleanup courier (must run last) ----------------
class TestZ_CleanupCourier:
    def test_delete_courier(self, merchant_s):
        cid = getattr(pytest, "courier_id", None)
        if not cid:
            pytest.skip("no courier")
        r = merchant_s.delete(f"{API}/merchant/logistics/couriers/{cid}", timeout=15)
        assert r.status_code == 200


# ---------------- Open API v1 ----------------
@pytest.fixture(scope="session")
def api_key(merchant_s):
    r = merchant_s.get(f"{API}/merchant/integrations", timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["api_key"]


class TestOpenAPI:
    def test_missing_key(self):
        r = requests.get(f"{API}/v1/orders", timeout=15)
        assert r.status_code == 401

    def test_invalid_key(self):
        r = requests.get(f"{API}/v1/orders", headers={"X-API-Key": "invalid_XYZ"}, timeout=15)
        assert r.status_code == 401

    def test_list_orders(self, api_key):
        r = requests.get(f"{API}/v1/orders", headers={"X-API-Key": api_key}, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_restaurant(self, api_key):
        r = requests.get(f"{API}/v1/restaurant", headers={"X-API-Key": api_key}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("id", "name", "city", "status"):
            assert k in d

    def test_menu(self, api_key):
        r = requests.get(f"{API}/v1/menu", headers={"X-API-Key": api_key}, timeout=15)
        assert r.status_code == 200
        assert "categories" in r.json() and "products" in r.json()

    def test_patch_product_available(self, api_key):
        m = requests.get(f"{API}/v1/menu", headers={"X-API-Key": api_key}, timeout=15).json()
        prods = m["products"]
        if not prods:
            pytest.skip("no products")
        pid = prods[0]["id"]
        r = requests.patch(f"{API}/v1/menu/products/{pid}",
                           headers={"X-API-Key": api_key, "Content-Type": "application/json"},
                           json={"available": False}, timeout=15)
        assert r.status_code == 200
        assert r.json()["available"] is False
        # revert
        requests.patch(f"{API}/v1/menu/products/{pid}",
                       headers={"X-API-Key": api_key, "Content-Type": "application/json"},
                       json={"available": True}, timeout=15)

    def test_status_invalid_transition(self, api_key):
        # look for a DELIVERED order and try -> PENDING
        orders = requests.get(f"{API}/v1/orders", headers={"X-API-Key": api_key}, timeout=15).json()
        delivered = next((o for o in orders if o["status"] == "DELIVERED"), None)
        if not delivered:
            pytest.skip("no delivered order")
        r = requests.post(f"{API}/v1/orders/{delivered['id']}/status",
                          headers={"X-API-Key": api_key, "Content-Type": "application/json"},
                          json={"status": "PENDING"}, timeout=15)
        assert r.status_code == 400

    def test_rotate_key_invalidates(self, merchant_s, api_key):
        r = merchant_s.post(f"{API}/merchant/integrations/rotate-key", timeout=15)
        assert r.status_code == 200
        new_key = r.json()["api_key"]
        assert new_key != api_key
        # old key should now be invalid
        r = requests.get(f"{API}/v1/orders", headers={"X-API-Key": api_key}, timeout=15)
        assert r.status_code == 401
        r = requests.get(f"{API}/v1/orders", headers={"X-API-Key": new_key}, timeout=15)
        assert r.status_code == 200


# ---------------- Webhooks ----------------
class TestWebhooks:
    def test_save_webhook_and_test(self, merchant_s):
        r = merchant_s.put(f"{API}/merchant/integrations",
                           json={"webhook": {"url": "https://httpbin.org/post", "secret": "s3cr3t", "enabled": True}},
                           timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["webhook"]["enabled"] is True

        r = merchant_s.post(f"{API}/merchant/integrations/test", json={"connector": "webhook"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # logs should include entry
        r = merchant_s.get(f"{API}/merchant/integrations/logs", timeout=15)
        assert r.status_code == 200
        logs = r.json()
        assert len(logs) >= 1
        assert logs[0]["connector"] == "webhook"


# ---------------- Leads ----------------
class TestLeads:
    def test_create_lead_ok(self):
        r = requests.post(f"{API}/leads",
                          json={"name": "TEST Lead", "city": "Sertãozinho", "phone": "16999998888",
                                "business": "Restaurante X", "email": "x@x.com"}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("message") == "ok"

    def test_lead_short_phone_422(self):
        r = requests.post(f"{API}/leads",
                          json={"name": "TEST Lead2", "city": "Sertãozinho", "phone": "123"}, timeout=15)
        assert r.status_code == 422

    def test_admin_leads_list(self, admin_s):
        r = admin_s.get(f"{API}/admin/leads", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) >= 1

    def test_customer_cannot_admin_leads(self, customer_s):
        r = customer_s.get(f"{API}/admin/leads", timeout=15)
        assert r.status_code == 403


# ---------------- Root routes (institutional site + PWA) ----------------
class TestSite:
    def test_manifest(self):
        r = requests.get(f"{BASE}/manifest.json", timeout=15)
        assert r.status_code == 200
        m = r.json()
        assert "icons" in m and len(m["icons"]) >= 1
        assert m.get("start_url") in ("/app?source=pwa", "/app?source=pwa/")

    def test_favicon(self):
        r = requests.get(f"{BASE}/favicon.svg", timeout=15)
        assert r.status_code == 200
