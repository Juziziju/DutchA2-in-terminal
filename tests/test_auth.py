"""Test authentication — register, login, protected routes."""


def test_register(client):
    resp = client.post("/auth/register", json={"username": "newuser", "password": "pass123"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["access_token"]
    assert data["username"] == "newuser"


def test_register_duplicate(client):
    client.post("/auth/register", json={"username": "dup", "password": "pass123"})
    resp = client.post("/auth/register", json={"username": "dup", "password": "pass123"})
    assert resp.status_code == 409


def test_register_short_password(client):
    resp = client.post("/auth/register", json={"username": "ab", "password": "short"})
    assert resp.status_code == 400


def test_login(client, user):
    resp = client.post("/auth/login", json={"username": "testuser", "password": "testpass123"})
    assert resp.status_code == 200
    assert resp.json()["access_token"]


def test_login_wrong_password(client, user):
    resp = client.post("/auth/login", json={"username": "testuser", "password": "wrong"})
    assert resp.status_code == 401


def test_protected_route_no_token(client):
    resp = client.get("/flashcards/session")
    assert resp.status_code == 401


def test_protected_route_with_token(client, auth_headers, sample_vocab):
    resp = client.get("/flashcards/session", headers=auth_headers)
    assert resp.status_code == 200
