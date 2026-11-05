from __future__ import annotations

from datetime import date

MONTH = date.today().strftime("%Y-%m")


def _auth(client) -> dict[str, str]:
    response = client.post(
        "/api/auth/setup",
        json={"name": "Erika", "email": "erika@example.com", "password": "password123"},
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_full_application_flow(client):
    assert client.get("/api/auth/status").json() == {"needs_setup": True}
    headers = _auth(client)
    assert client.get("/api/auth/status").json() == {"needs_setup": False}
    assert client.get("/api/accounts").status_code == 401

    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "erika@example.com"

    categories = client.get("/api/categories", headers=headers).json()
    assert len(categories) == 16
    food = next(item for item in categories if item["name"] == "Alimentari")
    salary = next(item for item in categories if item["name"] == "Stipendio")

    employer = client.post(
        "/api/payees",
        headers=headers,
        json={"name": "Azienda", "default_category_id": salary["id"]},
    )
    assert employer.status_code == 201, employer.text
    store = client.post(
        "/api/payees",
        headers=headers,
        json={"name": "Esselunga", "default_category_id": food["id"]},
    )
    assert store.status_code == 201, store.text
    duplicate = client.post("/api/payees", headers=headers, json={"name": "  esselunga "})
    assert duplicate.status_code == 409
    assert client.get("/api/payees?sort=recent", headers=headers).json()[0]["name"] in {"Azienda", "Esselunga"}

    checking = client.post(
        "/api/accounts",
        headers=headers,
        json={"name": "Conto principale", "type": "checking", "initial_balance": 1000, "color": "#0E7C66"},
    )
    assert checking.status_code == 201, checking.text
    checking_id = checking.json()["id"]
    savings = client.post(
        "/api/accounts",
        headers=headers,
        json={"name": "Risparmi", "type": "savings", "initial_balance": 5000},
    ).json()

    income = client.post(
        "/api/transactions",
        headers=headers,
        json={
            "type": "income",
            "amount": 2000,
            "date": date.today().isoformat(),
            "description": "Stipendio",
            "account_id": checking_id,
            "category_id": salary["id"],
            "payee_id": employer.json()["id"],
        },
    )
    assert income.status_code == 201, income.text
    assert income.json()["payee"]["name"] == "Azienda"

    expense = client.post(
        "/api/transactions",
        headers=headers,
        json={
            "type": "expense",
            "amount": 150.50,
            "date": date.today().isoformat(),
            "description": "Spesa settimanale",
            "account_id": checking_id,
            "payee_id": store.json()["id"],
        },
    )
    assert expense.status_code == 201, expense.text
    assert expense.json()["category"]["name"] == "Alimentari"
    assert expense.json()["payee"]["name"] == "Esselunga"

    transfer = client.post(
        "/api/transactions",
        headers=headers,
        json={
            "type": "transfer",
            "amount": 200,
            "date": date.today().isoformat(),
            "description": "Giroconto",
            "account_id": checking_id,
            "transfer_account_id": savings["id"],
        },
    )
    assert transfer.status_code == 201, transfer.text
    assert transfer.json()["payee"] is None

    accounts = {item["name"]: item for item in client.get("/api/accounts", headers=headers).json()}
    assert accounts["Conto principale"]["balance"] == 2649.50
    assert accounts["Risparmi"]["balance"] == 5200.00

    listing = client.get("/api/transactions", headers=headers).json()
    assert listing["total"] == 3
    assert listing["totals"]["income"] == 2000
    assert listing["totals"]["expense"] == 150.50

    filtered = client.get(f"/api/transactions?payee_id={store.json()['id']}", headers=headers).json()
    assert filtered["total"] == 1
    searched = client.get("/api/transactions?q=Esselunga", headers=headers).json()
    assert searched["total"] == 1
    payee_suggestions = client.get("/api/payees/suggestions", headers=headers).json()
    assert any(item["name"] == "Esselunga" for item in payee_suggestions)
    description_suggestions = client.get("/api/suggestions/descriptions?q=Spesa", headers=headers).json()
    assert description_suggestions["items"][0]["value"] == "Spesa settimanale"

    budget = client.post(
        "/api/budgets",
        headers=headers,
        json={"category_id": food["id"], "month": MONTH, "amount": 100},
    )
    assert budget.status_code == 201, budget.text
    assert budget.json()["items"][0]["over_budget"] is True
    assert budget.json()["items"][0]["spent"] == 150.50

    range_start = date.today().replace(day=1).isoformat()
    range_end = date.today().isoformat()
    summary = client.get(
        f"/api/reports/summary?date_from={range_start}&date_to={range_end}", headers=headers
    )
    assert summary.status_code == 200, summary.text
    summary_data = summary.json()
    assert summary_data["comparison"]["current"]["income"] == 2000
    assert summary_data["comparison"]["current"]["expense"] == 150.50
    assert len(summary_data["series"]) == 1

    calendar = client.get(
        f"/api/reports/calendar?date_from={range_start}&date_to={range_end}", headers=headers
    )
    assert calendar.status_code == 200, calendar.text
    assert calendar.json()["weekday"]
    assert calendar.json()["total"] == 150.50

    payees_report = client.get(
        f"/api/reports/payees?date_from={range_start}&date_to={range_end}", headers=headers
    )
    assert payees_report.status_code == 200, payees_report.text
    payee_items = payees_report.json()["items"]
    assert payee_items[0]["name"] == "Esselunga"
    assert payee_items[0]["amount"] == 150.50
    assert payee_items[0]["average"] == 150.50

    payee_detail = client.get(
        f"/api/reports/payees/{store.json()['id']}?date_from={range_start}&date_to={range_end}",
        headers=headers,
    )
    assert payee_detail.status_code == 200, payee_detail.text
    assert payee_detail.json()["total"] == 150.50
    assert payee_detail.json()["categories"][0]["name"] == "Alimentari"

    accounts_stats = client.get(
        f"/api/reports/accounts?date_from={range_start}&date_to={range_end}", headers=headers
    )
    assert accounts_stats.status_code == 200, accounts_stats.text
    assert accounts_stats.json()["transfers"][0]["from_account_name"] == "Conto principale"
    assert accounts_stats.json()["transfers"][0]["to_account_name"] == "Risparmi"

    budget_history = client.get("/api/reports/budget-history?months=6", headers=headers)
    assert budget_history.status_code == 200, budget_history.text
    assert len(budget_history.json()["months"]) == 6

    unused_payee = client.post("/api/payees", headers=headers, json={"name": "Da eliminare"})
    assert unused_payee.status_code == 201
    renamed = client.patch(
        f"/api/payees/{unused_payee.json()['id']}", headers=headers, json={"name": "Rinominato"}
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Rinominato"
    assert client.delete(f"/api/payees/{unused_payee.json()['id']}", headers=headers).status_code == 204
    assert client.delete(f"/api/payees/{store.json()['id']}", headers=headers).status_code == 409

    goal = client.post(
        "/api/goals",
        headers=headers,
        json={"name": "Vacanza", "target_amount": 1000, "target_date": "2026-08-01"},
    )
    assert goal.status_code == 201, goal.text
    goal_id = goal.json()["id"]
    goal = client.post(
        f"/api/goals/{goal_id}/contributions",
        headers=headers,
        json={"amount": 250, "date": date.today().isoformat(), "note": "Primo versamento"},
    ).json()
    assert goal["percentage"] == 25.0
    assert goal["contributed"] == 250

    recurring = client.post(
        "/api/recurring",
        headers=headers,
        json={
            "type": "expense",
            "amount": 15.99,
            "description": "Streaming",
            "account_id": checking_id,
            "category_id": food["id"],
            "payee_id": store.json()["id"],
            "frequency": "monthly",
            "start_date": date.today().isoformat(),
        },
    )
    assert recurring.status_code == 201, recurring.text
    assert recurring.json()["payee"]["name"] == "Esselunga"
    recurring_id = recurring.json()["id"]
    posted = client.post(f"/api/recurring/{recurring_id}/post", headers=headers)
    assert posted.status_code == 201, posted.text
    assert posted.json()["description"] == "Streaming"
    assert posted.json()["payee"]["name"] == "Esselunga"

    forecast = client.get("/api/recurring/forecast?months=3", headers=headers)
    assert forecast.status_code == 200, forecast.text
    assert len(forecast.json()["months"]) == 3

    dashboard = client.get(f"/api/reports/dashboard?month={MONTH}", headers=headers)
    assert dashboard.status_code == 200, dashboard.text
    payload = dashboard.json()
    assert payload["net_worth"] == 2649.50 + 5200.00 - 15.99
    assert payload["month_income"] == 2000
    assert len(payload["series"]) == 6
    assert payload["budgets"]["over_budget_count"] == 1

    trend = client.get("/api/reports/trend?months=6", headers=headers)
    assert trend.status_code == 200
    assert len(trend.json()["net_worth"]) == 6

    categories_report = client.get("/api/reports/categories", headers=headers)
    assert categories_report.status_code == 200
    assert categories_report.json()["total"] > 0

    cashflow = client.get("/api/reports/cashflow", headers=headers)
    assert cashflow.status_code == 200
    assert len(cashflow.json()["forecast"]) == 3

    export = client.get("/api/reports/export.csv", headers=headers)
    assert export.status_code == 200
    assert "Stipendio" in export.text
    assert "Esselunga" in export.text

    backup = client.get("/api/reports/export.json", headers=headers)
    assert backup.status_code == 200
    assert backup.json()["transactions"]

    settings = client.get("/api/settings", headers=headers).json()
    assert settings["transactions_count"] == 4
    assert settings["categories_count"] == 16

    wrong = client.post(
        "/api/settings/reset",
        headers=headers,
        json={"password": "sbagliata", "confirm": "ELIMINA"},
    )
    assert wrong.status_code == 400

    reset = client.post(
        "/api/settings/reset",
        headers=headers,
        json={"password": "password123", "confirm": "ELIMINA"},
    )
    assert reset.status_code == 200, reset.text
    assert client.get("/api/transactions", headers=headers).json()["total"] == 0
    assert len(client.get("/api/categories", headers=headers).json()) == 16
    assert client.get("/api/accounts", headers=headers).json() == []
    assert client.get("/api/payees", headers=headers).json() == []
