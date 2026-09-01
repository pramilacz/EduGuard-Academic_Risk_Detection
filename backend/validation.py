from __future__ import annotations

import math
from typing import Any, Iterable

import pandas as pd


CATEGORICAL_FEATURES = {
    "gender",
    "region",
    "highest_education",
    "imd_band",
    "age_band",
    "disability",
}

BINARY_FEATURES = {
    "registered_before_start_flag",
    "performance_declining_flag",
    "engagement_declining_flag",
}

SCORE_FEATURES = {
    "mean_assessment_score",
    "min_assessment_score",
    "max_assessment_score",
    "std_assessment_score",
    "weighted_mean_score",
    "early_mean_score",
    "late_mean_score",
}

NON_NEGATIVE_FEATURES = {
    "num_of_prev_attempts",
    "studied_credits",
    "module_presentation_length",
    "assessments_submitted",
    "low_score_count",
    "late_submission_count",
    "assessments_due",
    "total_clicks",
    "active_days",
    "active_weeks",
    "unique_vle_sites",
    "mean_clicks_per_record",
    "max_clicks_record",
    "week_1_clicks",
    "week_2_clicks",
    "week_3_clicks",
    "week_4_clicks",
    "week_5_clicks",
    "week_6_clicks",
    "week_7_clicks",
    "week_8_clicks",
    "early_mean_weekly_clicks",
    "late_mean_weekly_clicks",
    "clicks_per_active_day",
}


def _is_missing(value: Any) -> bool:
    if value is None:
        return True

    try:
        return bool(pd.isna(value))
    except Exception:
        return False


def _to_number(feature: str, value: Any) -> float | None:
    if _is_missing(value):
        return None

    if isinstance(value, bool):
        return float(int(value))

    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{feature} must be numeric.") from exc

    if not math.isfinite(number):
        raise ValueError(f"{feature} must be a finite number.")

    return number


def validate_student_input(student_data: dict[str, Any], feature_names: Iterable[str]) -> None:
    required = list(feature_names)

    missing_features = [feature for feature in required if feature not in student_data]
    if missing_features:
        raise ValueError("Missing required features: " + ", ".join(missing_features))

    for feature in required:
        value = student_data[feature]

        if feature in CATEGORICAL_FEATURES:
            if _is_missing(value):
                continue
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{feature} must be a non-empty text value when provided.")
            continue

        number = _to_number(feature, value)
        if number is None:
            # The trained preprocessing pipeline contains imputers, so missing
            # numeric values are allowed when the feature key itself is present.
            continue

        if feature in BINARY_FEATURES and number not in (0.0, 1.0):
            raise ValueError(f"{feature} must be 0 or 1.")

        if feature == "assessment_completion_rate" and not 0.0 <= number <= 1.0:
            raise ValueError("assessment_completion_rate must be between 0 and 1.")

        if feature in SCORE_FEATURES and not 0.0 <= number <= 100.0:
            raise ValueError(f"{feature} must be between 0 and 100.")

        if feature in NON_NEGATIVE_FEATURES and number < 0.0:
            raise ValueError(f"{feature} cannot be negative.")

        if feature == "active_weeks" and number > 8.0:
            raise ValueError("active_weeks cannot be greater than 8 for the prediction window.")

        if feature == "active_days" and number > 56.0:
            raise ValueError("active_days cannot be greater than 56 for the prediction window.")

        if feature == "last_activity_day" and number > 56.0:
            raise ValueError("last_activity_day cannot be greater than 56 for the prediction window.")

        if feature == "assessment_score_change" and not -100.0 <= number <= 100.0:
            raise ValueError("assessment_score_change must be between -100 and 100.")


def validate_dataframe(dataframe: pd.DataFrame, feature_names: Iterable[str]) -> None:
    required = list(feature_names)
    missing_columns = [feature for feature in required if feature not in dataframe.columns]
    if missing_columns:
        raise ValueError("Missing required features: " + ", ".join(missing_columns))

    problems: list[str] = []

    # Validate a bounded number of rows so an accidental huge file cannot create
    # an enormous error response. Prediction itself still runs on all rows once
    # validation succeeds.
    for row_number, (_, row) in enumerate(dataframe.iterrows(), start=1):
        try:
            validate_student_input(row.to_dict(), required)
        except ValueError as error:
            problems.append(f"Row {row_number}: {error}")
            if len(problems) >= 5:
                break

    if problems:
        raise ValueError("Invalid CSV data. " + " | ".join(problems))
