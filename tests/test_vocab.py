"""Test vocab endpoints — list, upload CSV."""

import io


def test_list_vocab(client, auth_headers, sample_vocab):
    resp = client.get("/vocab", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 5


def test_upload_csv(client, auth_headers):
    csv_content = "dutch,english,category,example_dutch,example_english\nhuis,house,Daily,Het huis is groot,The house is big\nboom,tree,Nature,De boom is groen,The tree is green"
    resp = client.post(
        "/vocab/upload-csv",
        headers=auth_headers,
        files={"file": ("vocab.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["added"] == 2
    assert data["skipped"] == 0


def test_upload_csv_skip_duplicates(client, auth_headers, sample_vocab):
    # sample_vocab has woord0..woord4
    csv_content = "dutch,english,category\nwoord0,word0,test\nnieuw,new,test"
    resp = client.post(
        "/vocab/upload-csv",
        headers=auth_headers,
        files={"file": ("vocab.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    )
    data = resp.json()
    assert data["added"] == 1  # only "nieuw"
    assert data["skipped"] == 1  # "woord0" already exists


def test_upload_csv_bad_format(client, auth_headers):
    resp = client.post(
        "/vocab/upload-csv",
        headers=auth_headers,
        files={"file": ("data.txt", io.BytesIO(b"not csv"), "text/plain")},
    )
    assert resp.status_code == 400
