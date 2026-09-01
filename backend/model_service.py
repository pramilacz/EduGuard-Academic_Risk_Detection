from pathlib import Path
import json
import joblib
import pandas as pd

from validation import validate_dataframe, validate_student_input


# ---------------------------------------------------------
# File locations
# ---------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = BASE_DIR / "models" / "final_ml_model.joblib"
FEATURES_PATH = BASE_DIR / "models" / "model_input_features.json"


class ModelService:
    def __init__(self):
        self.model = None
        self.feature_names = []
        self.load_error = None

        self.load_model()

    # -----------------------------------------------------
    # Read feature names
    # -----------------------------------------------------

    def load_feature_names(self):
        with open(FEATURES_PATH, "r", encoding="utf-8") as file:
            data = json.load(file)

        # Most likely format: JSON list
        if isinstance(data, list):
            return [str(feature) for feature in data]

        # Also support dictionary-based JSON files
        if isinstance(data, dict):
            possible_keys = [
                "features",
                "feature_names",
                "model_input_features",
                "columns",
            ]

            for key in possible_keys:
                if key in data and isinstance(data[key], list):
                    return [str(feature) for feature in data[key]]

        raise ValueError(
            "Could not understand model_input_features.json format."
        )

    # -----------------------------------------------------
    # Load saved XGBoost pipeline
    # -----------------------------------------------------

    def load_model(self):
        try:
            if not MODEL_PATH.exists():
                raise FileNotFoundError(
                    f"Model file not found: {MODEL_PATH}"
                )

            if not FEATURES_PATH.exists():
                raise FileNotFoundError(
                    f"Feature file not found: {FEATURES_PATH}"
                )

            self.feature_names = self.load_feature_names()

            self.model = joblib.load(MODEL_PATH)

            # Basic model checks
            if not hasattr(self.model, "predict"):
                raise ValueError(
                    "Loaded object does not contain predict()."
                )

            if not hasattr(self.model, "predict_proba"):
                raise ValueError(
                    "Loaded object does not contain predict_proba()."
                )

            self.load_error = None

            print("---------------------------------------")
            print("EduGuard ML model loaded successfully")
            print("Model path:", MODEL_PATH)
            print("Number of features:", len(self.feature_names))
            print("Model type:", type(self.model).__name__)
            print("---------------------------------------")

        except Exception as error:
            self.model = None
            self.load_error = str(error)

            print("---------------------------------------")
            print("EduGuard model loading FAILED")
            print("Reason:", self.load_error)
            print("---------------------------------------")

    # -----------------------------------------------------
    # Model status
    # -----------------------------------------------------

    @property
    def ready(self):
        return self.model is not None and self.load_error is None

    def get_status(self):
        return {
            "ready": self.ready,
            "model_file": MODEL_PATH.name,
            "feature_file": FEATURES_PATH.name,
            "number_of_features": len(self.feature_names),
            "error": self.load_error,
        }
    
    # Predict one student
    def predict_one(self, student_data: dict):
        validate_student_input(
            student_data,
            self.feature_names,
        )

        if not self.ready:
            raise RuntimeError(
                f"Model is not ready. Error: {self.load_error}"
            )

        # Keep only the exact 45 model features
        model_input = {
            feature: student_data[feature]
            for feature in self.feature_names
        }

        # Convert student data to a DataFrame
        input_df = pd.DataFrame(
            [model_input],
            columns=self.feature_names
        )

        # Real XGBoost prediction
        prediction = int(self.model.predict(input_df)[0])

        # Real prediction probabilities
        probabilities = self.model.predict_proba(input_df)[0]

        lower_risk_probability = float(probabilities[0])
        high_risk_probability = float(probabilities[1])

        risk_label = (
            "High Risk"
            if prediction == 1
            else "Lower Risk"
        )

        return {
            "prediction": prediction,
            "risk_label": risk_label,
            "risk_probability": high_risk_probability,
            "lower_risk_probability": lower_risk_probability,
        }

        # -----------------------------------------------------
    # Predict multiple students
    # -----------------------------------------------------

    def predict_batch(self, dataframe: pd.DataFrame):
        validate_dataframe(
            dataframe,
            self.feature_names,
        )

        if not self.ready:
            raise RuntimeError(
                f"Model is not ready. Error: {self.load_error}"
            )

        # Preserve useful identifiers if available
        identifier_columns = [
            column
            for column in [
                "id_student",
                "code_module",
                "code_presentation",
            ]
            if column in dataframe.columns
        ]

        # Exact model inputs
        input_df = dataframe[self.feature_names].copy()

        # Real predictions
        predictions = self.model.predict(input_df)

        # Real probabilities
        probabilities = self.model.predict_proba(input_df)

        results = []

        for index in range(len(dataframe)):
            prediction = int(predictions[index])

            student_result = {}

            # Add identifiers
            for column in identifier_columns:
                value = dataframe.iloc[index][column]

                if pd.isna(value):
                    student_result[column] = None
                elif hasattr(value, "item"):
                    student_result[column] = value.item()
                else:
                    student_result[column] = value

            student_result.update({
                "prediction": prediction,
                "risk_label": (
                    "High Risk"
                    if prediction == 1
                    else "Lower Risk"
                ),
                "risk_probability": float(
                    probabilities[index][1]
                ),
                "lower_risk_probability": float(
                    probabilities[index][0]
                ),
            })

            results.append(student_result)

        return results


# One shared model instance
model_service = ModelService()