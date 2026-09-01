"""Repeatable Phase 10E validation checks for EduGuard.

Run from the backend folder using the project's Python environment:

    python phase10e_validation.py

The script does not overwrite the saved cohort. It validates the currently
persisted cohort and exercises read-only / single-student API paths.
"""

from __future__ import annotations

import math
import sys
from typing import Any

import pandas as pd
from fastapi.testclient import TestClient

import main
from persistence import load_latest_state


class ValidationFailure(Exception):
    pass


def check(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationFailure(message)


def json_safe_record(record: dict[str, Any]) -> dict[str, Any]:
    output: dict[str, Any] = {}
    for key, value in record.items():
        try:
            if pd.isna(value):
                output[key] = None
                continue
        except Exception:
            pass

        if hasattr(value, "item"):
            try:
                value = value.item()
            except Exception:
                pass

        output[key] = value
    return output


def run() -> int:
    checks: list[tuple[str, bool, str]] = []

    def record(name: str, fn) -> None:
        try:
            fn()
            checks.append((name, True, ""))
        except Exception as error:  # validation report should continue
            checks.append((name, False, str(error)))

    client = TestClient(main.app)

    record(
        "Backend health and model load",
        lambda: (
            check(client.get("/api/eduguard/health").status_code == 200, "Health endpoint failed"),
            check(client.get("/api/eduguard/health").json()["status"] == "ok", "Model is not ready"),
        ),
    )

    record(
        "45-feature contract",
        lambda: (
            check(len(main.model_service.feature_names) == 45, "Expected 45 model features"),
            check(client.get("/api/eduguard/features").status_code == 200, "Feature endpoint failed"),
        ),
    )

    def persistence_check() -> None:
        cohort, predictions = load_latest_state()
        check(cohort is not None and not cohort.empty, "No persisted cohort found")
        check(len(predictions) == len(cohort), "Persisted cohort/prediction counts differ")
        cohort_ids = set(cohort["id_student"].astype(str)) if "id_student" in cohort.columns else set()
        for prediction in predictions:
            probability = float(prediction["risk_probability"])
            check(0.0 <= probability <= 1.0, "Stored probability outside 0..1")
            check(len(prediction.get("weekly_activity", [])) == 8, "Stored weekly activity must have 8 values")
            if cohort_ids:
                check(str(prediction["student_id"]) in cohort_ids, "Stored student missing from cohort")

    record("Persistence integrity", persistence_check)

    def predictions_endpoint_check() -> None:
        response = client.get("/api/eduguard/predictions")
        check(response.status_code == 200, f"GET predictions returned {response.status_code}")
        payload = response.json()
        check(payload["total_students"] == len(payload["results"]), "Prediction count mismatch")
        for item in payload["results"]:
            probability = float(item["risk_probability"])
            check(0.0 <= probability <= 1.0, "API probability outside 0..1")

    record("Saved predictions endpoint", predictions_endpoint_check)

    def end_to_end_single_student() -> None:
        check(main.latest_cohort_df is not None and not main.latest_cohort_df.empty, "No cohort row available")
        row = json_safe_record(main.latest_cohort_df.iloc[0].to_dict())

        response = client.post("/api/eduguard/predict", json=row)
        check(response.status_code == 200, f"Prediction returned {response.status_code}: {response.text}")
        result = response.json()["result"]
        probability = float(result["risk_probability"])
        lower_probability = float(result["lower_risk_probability"])
        check(0.0 <= probability <= 1.0, "High-risk probability outside 0..1")
        check(math.isclose(probability + lower_probability, 1.0, rel_tol=1e-6, abs_tol=1e-6), "Probabilities do not sum to 1")
        expected_label = "High Risk" if result["prediction"] == 1 else "Lower Risk"
        check(result["risk_label"] == expected_label, "Prediction label does not match class")

        explanation_response = client.post("/api/eduguard/explain", json=row)
        check(
            explanation_response.status_code == 200,
            f"Explanation returned {explanation_response.status_code}: {explanation_response.text}",
        )
        explanation = explanation_response.json()["explanation"]
        check(len(explanation["top_factors"]) > 0, "No SHAP factors returned")
        check(
            math.isclose(
                float(explanation["prediction"]["risk_probability"]),
                probability,
                rel_tol=1e-9,
                abs_tol=1e-9,
            ),
            "SHAP explanation does not belong to the same prediction",
        )

        student_id = str(row.get("id_student"))
        saved_explanation = client.get(f"/api/eduguard/explanations/{student_id}")
        check(saved_explanation.status_code == 200, "Saved-student explanation endpoint failed")

    record("Prediction + SHAP end-to-end", end_to_end_single_student)

    def invalid_input_check() -> None:
        response = client.post("/api/eduguard/predict", json={})
        check(response.status_code == 400, f"Missing-feature request should be 400, got {response.status_code}")

        check(main.latest_cohort_df is not None and not main.latest_cohort_df.empty, "No cohort row available")
        row = json_safe_record(main.latest_cohort_df.iloc[0].to_dict())
        row["assessment_completion_rate"] = 1.5
        response = client.post("/api/eduguard/predict", json=row)
        check(response.status_code == 400, f"Out-of-range input should be 400, got {response.status_code}")

    record("Invalid input rejection", invalid_input_check)

    print("\nEduGuard Phase 10E validation")
    print("=" * 36)
    for name, passed, detail in checks:
        print(f"{'PASS' if passed else 'FAIL'}  {name}")
        if detail:
            print(f"      {detail}")

    failures = [item for item in checks if not item[1]]
    print("-" * 36)
    print(f"Passed: {len(checks) - len(failures)}/{len(checks)}")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(run())
