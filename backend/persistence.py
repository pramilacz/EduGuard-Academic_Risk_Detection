from pathlib import Path
import json

import pandas as pd

import os

IS_VERCEL = bool(os.getenv("VERCEL"))


# -------------------------------------------------
# Storage locations
# -------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent

DATA_DIR = BASE_DIR / "data"

COHORT_PATH = DATA_DIR / "latest_cohort.csv"
PREDICTIONS_PATH = DATA_DIR / "latest_predictions.json"


# Create the data folder automatically
DATA_DIR.mkdir(parents=True, exist_ok=True)


# -------------------------------------------------
# Convert values into JSON-safe values
# -------------------------------------------------

def make_json_safe(value):
    if isinstance(value, dict):
        return {
            key: make_json_safe(item)
            for key, item in value.items()
        }

    if isinstance(value, list):
        return [
            make_json_safe(item)
            for item in value
        ]

    try:
        if pd.isna(value):
            return None
    except Exception:
        pass

    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            pass

    return value


# -------------------------------------------------
# Save latest cohort and predictions
# -------------------------------------------------

def save_latest_state(
    dataframe: pd.DataFrame,
    predictions: list,
):
    if IS_VERCEL:
        return
    
    # Write to temporary files first, then replace the live files. This keeps
    # the previous valid state intact if the process is interrupted mid-write.
    cohort_temp_path = COHORT_PATH.with_suffix(".csv.tmp")
    predictions_temp_path = PREDICTIONS_PATH.with_suffix(".json.tmp")

    dataframe.to_csv(
        cohort_temp_path,
        index=False
    )

    # Save prediction results
    safe_predictions = make_json_safe(
        predictions
    )

    with open(
        predictions_temp_path,
        "w",
        encoding="utf-8"
    ) as file:
        json.dump(
            safe_predictions,
            file,
            indent=2,
            ensure_ascii=False
        )

    cohort_temp_path.replace(COHORT_PATH)
    predictions_temp_path.replace(PREDICTIONS_PATH)

    print(
        f"Saved latest EduGuard cohort: "
        f"{len(dataframe)} students"
    )


# -------------------------------------------------
# Load latest saved state
# -------------------------------------------------

def load_latest_state():

    dataframe = None
    predictions = []

    # Load cohort
    if COHORT_PATH.exists():
        try:
            dataframe = pd.read_csv(
                COHORT_PATH
            )

            print(
                f"Loaded saved cohort: "
                f"{len(dataframe)} students"
            )

        except Exception as error:
            print(
                "Could not load saved cohort:",
                error
            )

    # Load predictions
    if PREDICTIONS_PATH.exists():
        try:
            with open(
                PREDICTIONS_PATH,
                "r",
                encoding="utf-8"
            ) as file:
                predictions = json.load(
                    file
                )

            print(
                f"Loaded saved predictions: "
                f"{len(predictions)} students"
            )

            if not isinstance(predictions, list):
                raise ValueError(
                    "Saved predictions must be a JSON list."
                )

        except Exception as error:
            predictions = []
            print(
                "Could not load saved predictions:",
                error
            )

    return dataframe, predictions