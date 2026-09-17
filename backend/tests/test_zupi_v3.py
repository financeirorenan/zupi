"""Backend tests for iteration 3: support threads, impersonation, cron reminders, billing."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

CRON_SECRET = ""
with open("/app/backend/.env") as f:
    for line in f:
        if line.startswith("WEBHOOK_CRON_SECRET"):
            CRON_SECRET = line.split("=", 1)[1].strip()

ADMIN = ("financeirorenanuk@gmail.com", "Zupi@2026")
MERCHANT = ("lojista@zupi.com", "zupi123")
CUSTOMER = ("cliente@zupi.com", "zupi123")
CUSTOMER2 = ("joao@zupi.com", "zupi123")


def login(email, pw):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, f"login {email} => {r.status_code} {r.text}"
    return s


# ---------------- Support threads ----------------
class TestSupport:
    def test_customer_support_thread(self):
        s = login(*CUSTOMER)
        r = s.post(f"{BASE_URL}/api/support", json={"subject": "TEST_ticket", "message": "Preciso de ajuda", "category": "pedido"})
        assert r.status_code == 200
        tid = r.json()["id"]

        # owner can GET
        r = s.get(f"{BASE_URL}/api/support/{tid}")
        assert r.status_code == 200
        assert r.json()["id"] == tid

        # another customer 404
        s2 = login(*CUSTOMER2)
        r = s2.get(f"{BASE_URL}/api/support/{tid}")
        assert r.status_code == 404

        # customer reply
        r = s.post(f"{BASE_URL}/api/support/{tid}/messages", json={"message": "Mais info aqui"})
        assert r.status_code == 200
        assert len(r.json()["messages"]) >= 2

        # admin closes then customer reply reopens
        sa = login(*ADMIN)
        r = sa.post(f"{BASE_URL}/api/admin/support/{tid}/reply", json={"message": "Resolvido", "close": True})
        assert r.status_code == 200
        # verify status
        r = s.get(f"{BASE_URL}/api/support/{tid}")
        assert r.json()["status"] == "closed"
        # customer replies -> reopens
        r = s.post(f"{BASE_URL}/api/support/{tid}/messages", json={"message": "Ainda com dúvida"})
        assert r.status_code == 200
        assert r.json()["status"] == "open"

        # admin notification created (type=support)
        r = sa.get(f"{BASE_URL}/api/notifications")
        assert r.status_code == 200
        assert any(n.get("type") == "support" for n in r.json()["items"])


# ---------------- Impersonation ----------------
class TestImpersonation:
    def test_impersonate_flow(self):
        # find a restaurant id
        sa = login(*ADMIN)
        rests = sa.get(f"{BASE_URL}/api/admin/restaurants").json()
        # pick lojista demo
        rid = None
        for r in rests:
            if r.get("name", "").lower().startswith("sabor"):
                rid = r["id"]; break
        assert rid, "demo restaurant not found"

        # non-admin => 403
        sc = login(*CUSTOMER)
        r = sc.post(f"{BASE_URL}/api/admin/restaurants/{rid}/impersonate")
        assert r.status_code == 403

        # admin impersonates
        r = sa.post(f"{BASE_URL}/api/admin/restaurants/{rid}/impersonate")
        assert r.status_code == 200
        body = r.json()
        assert body.get("role") == "restaurant"
        assert body.get("impersonated_by")

        # /auth/me shows impersonated_by
        me = sa.get(f"{BASE_URL}/api/auth/me").json()
        assert me.get("role") == "restaurant"
        assert me.get("impersonated_by")

        # stop
        r = sa.post(f"{BASE_URL}/api/auth/impersonate/stop")
        assert r.status_code == 200
        me = sa.get(f"{BASE_URL}/api/auth/me").json()
        assert me["role"] == "admin"
        assert not me.get("impersonated_by")

        # stop without imp flag => 400
        r = sa.post(f"{BASE_URL}/api/auth/impersonate/stop")
        assert r.status_code == 400


# ---------------- Cron invoice reminders ----------------
class TestCron:
    def test_cron_unauthorized(self):
        r = requests.post(f"{BASE_URL}/api/cron/invoice-reminders")
        assert r.status_code == 401

    def test_cron_accept_and_duplicate(self):
        run_id = f"test-{uuid.uuid4()}"
        headers = {"Authorization": f"Bearer {CRON_SECRET}", "X-Webhook-Id": run_id}
        r = requests.post(f"{BASE_URL}/api/cron/invoice-reminders", headers=headers)
        assert r.status_code == 200
        assert r.json()["status"] == "accepted"
        r2 = requests.post(f"{BASE_URL}/api/cron/invoice-reminders", headers=headers)
        assert r2.status_code == 200
        assert r2.json()["status"] == "duplicate"


# ---------------- Billing ----------------
class TestBilling:
    def test_admin_billing_list(self):
        sa = login(*ADMIN)
        r = sa.get(f"{BASE_URL}/api/admin/billing")
        assert r.status_code == 200
        data = r.json()
        for k in ("invoices", "totals", "restaurants", "counts"):
            assert k in data

    def test_generate_idempotent(self):
        sa = login(*ADMIN)
        sa.post(f"{BASE_URL}/api/admin/billing/generate")  # first
        r = sa.post(f"{BASE_URL}/api/admin/billing/generate")
        assert r.status_code == 200
        assert r.json()["created"] == 0

    def test_pay_and_reopen(self):
        sa = login(*ADMIN)
        invs = sa.get(f"{BASE_URL}/api/admin/billing").json()["invoices"]
        target = next((i for i in invs if i["status"] in ("open", "overdue")), None)
        if not target:
            pytest.skip("no open invoice")
        iid = target["id"]
        r = sa.post(f"{BASE_URL}/api/admin/billing/{iid}/pay", json={"payment_note": "TEST"})
        assert r.status_code == 200
        assert r.json()["status"] == "paid"
        r = sa.post(f"{BASE_URL}/api/admin/billing/{iid}/reopen")
        assert r.status_code == 200
        assert r.json()["status"] in ("open", "overdue")

    def test_set_period_invalid(self):
        sa = login(*ADMIN)
        rests = sa.get(f"{BASE_URL}/api/admin/billing").json()["restaurants"]
        rid = rests[0]["id"]
        r = sa.put(f"{BASE_URL}/api/admin/billing/restaurants/{rid}/period", json={"billing_period": "yearly"})
        assert r.status_code == 422

    def test_set_period_valid(self):
        sa = login(*ADMIN)
        rests = sa.get(f"{BASE_URL}/api/admin/billing").json()["restaurants"]
        rid = rests[0]["id"]
        r = sa.put(f"{BASE_URL}/api/admin/billing/restaurants/{rid}/period", json={"billing_period": "monthly"})
        assert r.status_code == 200
        assert r.json()["billing_period"] == "monthly"

    def test_billing_settings(self):
        sa = login(*ADMIN)
        r = sa.put(f"{BASE_URL}/api/admin/billing/settings", json={
            "billing_period": "monthly", "billing_due_days": 5,
            "billing_pix_key": "12345678900", "billing_pix_name": "Zupi Test",
        })
        assert r.status_code == 200
        assert r.json()["billing_pix_key"] == "12345678900"

    def test_merchant_billing(self):
        sm = login(*MERCHANT)
        r = sm.get(f"{BASE_URL}/api/merchant/billing")
        assert r.status_code == 200
        data = r.json()
        assert "current" in data and "invoices" in data
        cur = data["current"]
        for k in ("period", "amount", "orders"):
            assert k in cur

    def test_merchant_invoice_detail(self):
        sm = login(*MERCHANT)
        invs = sm.get(f"{BASE_URL}/api/merchant/billing").json()["invoices"]
        if not invs:
            pytest.skip("no invoice for merchant")
        r = sm.get(f"{BASE_URL}/api/merchant/billing/{invs[0]['id']}")
        assert r.status_code == 200
        assert "transactions" in r.json()

    def test_merchant_cannot_access_admin_billing(self):
        sm = login(*MERCHANT)
        r = sm.get(f"{BASE_URL}/api/admin/billing")
        assert r.status_code == 403
