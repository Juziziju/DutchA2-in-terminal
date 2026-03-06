"""Test speaking endpoints — scenes, mock exams, history."""


def test_list_scenes(client, auth_headers):
    resp = client.get("/speaking/scenes", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    # First scene always unlocked
    assert data[0]["unlocked"] is True
    assert data[0]["id"] == "self_intro"
    # Second scene locked (no recordings yet)
    assert data[1]["unlocked"] is False


def test_scene_detail(client, auth_headers):
    resp = client.get("/speaking/scenes/self_intro", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["vocab"]) > 0
    assert len(data["model_sentences"]) > 0


def test_scene_detail_not_found(client, auth_headers):
    resp = client.get("/speaking/scenes/nonexistent", headers=auth_headers)
    assert resp.status_code == 404


def test_scene_questions(client, auth_headers):
    resp = client.get("/speaking/scenes/self_intro/questions", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "short" in data
    assert "long" in data
    assert len(data["short"]) >= 1
    assert len(data["long"]) >= 1
    # Each question has required fields
    q = data["short"][0]
    assert "id" in q
    assert "prompt_nl" in q
    assert "prompt_en" in q
    assert "prep_seconds" in q
    assert "record_seconds" in q
    assert "expected_phrases" in q
    assert "model_answer" in q


def test_mock_exam_list(client, auth_headers):
    resp = client.get("/speaking/mock-exams", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    assert data[0]["short_count"] == 8
    assert data[0]["long_count"] == 8


def test_mock_exam_detail(client, auth_headers):
    resp = client.get("/speaking/mock-exams/mock_1", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["short"]) == 8
    assert len(data["long"]) == 8
    # Verify question structure
    q = data["short"][0]
    assert q["id"] == "m1_s01"
    assert "prompt_nl" in q
    assert "model_answer" in q


def test_mock_exam_not_found(client, auth_headers):
    resp = client.get("/speaking/mock-exams/nonexistent", headers=auth_headers)
    assert resp.status_code == 404


def test_speaking_history_empty(client, auth_headers):
    resp = client.get("/speaking/history", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_speaking_bank_content_quality():
    """Verify speaking bank data integrity."""
    from backend.core.speaking_bank import SPEAKING_SCENES, MOCK_EXAM_SETS, get_question, get_mock_question

    # All scenes have required fields
    for scene_id, scene in SPEAKING_SCENES.items():
        assert scene["id"] == scene_id
        assert len(scene["vocab"]) >= 10
        assert len(scene["model_sentences"]) >= 5
        for qtype in ("short", "long"):
            for q in scene["exam_questions"][qtype]:
                assert "id" in q
                assert "prompt_nl" in q
                assert "prompt_en" in q
                assert "model_answer" in q
                assert "expected_phrases" in q
                assert len(q["expected_phrases"]) > 0

    # All mock exams have 8+8 questions
    for exam in MOCK_EXAM_SETS:
        assert len(exam["short"]) == 8
        assert len(exam["long"]) == 8
        for qtype in ("short", "long"):
            for q in exam[qtype]:
                assert "id" in q
                assert "prompt_nl" in q
                assert "model_answer" in q
                assert len(q["model_answer"]) > 10

    # get_question works
    q = get_question("self_intro", "si_s1")
    assert q is not None
    assert q["question_type"] == "short"

    # get_mock_question works
    q = get_mock_question("mock_1", "m1_s01")
    assert q is not None
    assert q["question_type"] == "short"

    # Nonexistent returns None
    assert get_question("fake", "fake") is None
    assert get_mock_question("fake", "fake") is None


def test_all_mock_question_ids_unique():
    """All question IDs across all mock exams must be unique."""
    from backend.core.speaking_bank import MOCK_EXAM_SETS
    all_ids = []
    for exam in MOCK_EXAM_SETS:
        for qtype in ("short", "long"):
            for q in exam[qtype]:
                all_ids.append(q["id"])
    assert len(all_ids) == len(set(all_ids)), f"Duplicate IDs found: {[x for x in all_ids if all_ids.count(x) > 1]}"
