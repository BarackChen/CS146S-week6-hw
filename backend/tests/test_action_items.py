def test_create_complete_list_and_patch_action_item(client):
    payload = {"description": "Ship it"}
    r = client.post("/action-items/", json=payload)
    assert r.status_code == 201, r.text
    item = r.json()
    assert item["completed"] is False
    assert "created_at" in item and "updated_at" in item

    r = client.put(f"/action-items/{item['id']}/complete")
    assert r.status_code == 200
    done = r.json()
    assert done["completed"] is True

    r = client.get(
        "/action-items/", params={"completed": True, "limit": 5, "sort": "-created_at"}
    )
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1

    r = client.patch(f"/action-items/{item['id']}", json={"description": "Updated"})
    assert r.status_code == 200
    patched = r.json()
    assert patched["description"] == "Updated"


def test_count_action_items_respects_completed_filter(client):
    r = client.post("/action-items/", json={"description": "Open task"})
    assert r.status_code == 201, r.text

    r = client.post("/action-items/", json={"description": "Done task"})
    assert r.status_code == 201, r.text
    done_item = r.json()

    r = client.put(f"/action-items/{done_item['id']}/complete")
    assert r.status_code == 200

    r = client.get("/action-items/count")
    assert r.status_code == 200
    assert r.json() == {"total": 2}

    r = client.get("/action-items/count", params={"completed": True})
    assert r.status_code == 200
    assert r.json() == {"total": 1}

    r = client.get("/action-items/count", params={"completed": False})
    assert r.status_code == 200
    assert r.json() == {"total": 1}
