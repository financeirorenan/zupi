# Auth Testing Playbook (Zupi Delivery)

Step 1: MongoDB Verification
```
mongosh
use test_database
db.users.find({role: "admin"}).pretty()
```
Verify: bcrypt hash starts with `$2b$`, indexes on users.email (unique), login_attempts.identifier, password_reset_tokens.expires_at (TTL), password_reset_tokens.token_hash (unique).

Step 2: API Testing
```
curl -c cookies.txt -X POST $API/api/auth/login -H "Content-Type: application/json" -d '{"email":"financeirorenanuk@gmail.com","password":"Zupi@2026"}'
curl -b cookies.txt $API/api/auth/me
```
Login returns user object + sets access_token/refresh_token cookies.

Step 3: Password Reset (documented fallback logs reset link to backend log when FRONTEND_URL is loopback)
1. Register test account via POST /api/auth/register
2. POST /api/auth/forgot-password with registered vs unregistered email — responses must be identical generic 200
3. Complete reset with token from backend log: new password logs in, old does not, token reuse fails
4. Throttle: 6th forgot-password in 15min window for same email creates no new token, still generic 200
5. Lockout clearance: 5 failed logins -> lockout; reset password; login succeeds

Endpoints: /api/auth/register, /login, /logout, /me, /refresh, /forgot-password, /reset-password
