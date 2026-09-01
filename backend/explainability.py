import numpy as np
import pandas as pd
import shap

from model_service import model_service
from validation import validate_student_input


class ExplainabilityService:

    def __init__(self):
        self.explainer = None
        self.preprocessor = None
        self.estimator = None
        self.transformed_feature_names = None

    # -----------------------------------------------------
    # Prepare SHAP explainer
    # -----------------------------------------------------

    def prepare(self):
        if not model_service.ready:
            raise RuntimeError(
                "The ML model is not ready."
            )

        if self.explainer is not None:
            return

        pipeline = model_service.model

        # Your saved model is a sklearn Pipeline
        self.preprocessor = pipeline.named_steps["preprocessor"]
        self.estimator = pipeline.named_steps["model"]

        # Create SHAP TreeExplainer for XGBoost
        self.explainer = shap.TreeExplainer(
            self.estimator
        )

        try:
            self.transformed_feature_names = np.array(
                self.preprocessor.get_feature_names_out()
            )
        except Exception:
            self.transformed_feature_names = None

    # -----------------------------------------------------
    # Convert transformed names back to original features
    # -----------------------------------------------------

    def original_feature_name(self, transformed_name):
        name = str(transformed_name)

        # Remove transformer prefix such as:
        # categorical__gender_M
        # numeric__total_clicks

        if "__" in name:
            name = name.split("__", 1)[1]

        # Exact original feature match
        if name in model_service.feature_names:
            return name

        # For one-hot encoded categorical features
        # Find which original feature the transformed
        # feature belongs to.
        possible_matches = sorted(
            model_service.feature_names,
            key=len,
            reverse=True
        )

        for feature in possible_matches:
            if name.startswith(feature + "_"):
                return feature

        return name

    # -----------------------------------------------------
    # Friendly labels
    # -----------------------------------------------------

    def friendly_name(self, feature):
        special_names = {
            "imd_band": "IMD Band",
            "highest_education": "Highest Education",
            "assessment_completion_rate":
                "Assessment Completion Rate",
            "mean_assessment_score":
                "Mean Assessment Score",
            "weighted_mean_score":
                "Weighted Mean Score",
            "late_mean_score":
                "Late Mean Score",
            "last_activity_day":
                "Last Activity Day",
            "late_submission_count":
                "Late Submission Count",
            "studied_credits":
                "Studied Credits",
            "total_clicks":
                "Total Learning Clicks",
            "active_days":
                "Active Days",
            "active_weeks":
                "Active Weeks",
            "week_8_clicks":
                "Week 8 Learning Clicks",
            "engagement_change":
                "Engagement Change",
            "engagement_declining_flag":
                "Engagement Declining Flag",
            "performance_declining_flag":
                "Performance Declining Flag",
        }

        if feature in special_names:
            return special_names[feature]

        return feature.replace("_", " ").title()

    # -----------------------------------------------------
    # Explain one student
    # -----------------------------------------------------

    def explain_one(self, student_data: dict, top_n: int = 10):
        validate_student_input(
            student_data,
            model_service.feature_names,
        )

        self.prepare()

        # Exact model input
        model_input = {
            feature: student_data[feature]
            for feature in model_service.feature_names
        }

        input_df = pd.DataFrame(
            [model_input],
            columns=model_service.feature_names
        )

        # Transform exactly as the trained pipeline does
        transformed = self.preprocessor.transform(
            input_df
        )

        if hasattr(transformed, "toarray"):
            transformed = transformed.toarray()

        transformed = np.asarray(transformed)

        # SHAP values
        shap_values = self.explainer.shap_values(
            transformed
        )

        # Handle different SHAP output formats
        if isinstance(shap_values, list):
            if len(shap_values) > 1:
                values = np.asarray(
                    shap_values[1]
                )[0]
            else:
                values = np.asarray(
                    shap_values[0]
                )[0]
        else:
            values = np.asarray(shap_values)

            if values.ndim == 3:
                values = values[0, :, 1]
            elif values.ndim == 2:
                values = values[0]

        # Feature names
        if self.transformed_feature_names is None:
            transformed_names = np.array([
                f"feature_{i}"
                for i in range(len(values))
            ])
        else:
            transformed_names = (
                self.transformed_feature_names
            )

        # -------------------------------------------------
        # Aggregate transformed SHAP values back to
        # original 45 features
        # -------------------------------------------------

        aggregated = {}

        for name, value in zip(
            transformed_names,
            values
        ):
            original = self.original_feature_name(
                name
            )

            aggregated[original] = (
                aggregated.get(original, 0.0)
                + float(value)
            )

        # Sort by absolute influence
        sorted_features = sorted(
            aggregated.items(),
            key=lambda item: abs(item[1]),
            reverse=True
        )

        top_features = sorted_features[:top_n]

        increasing_risk = []
        reducing_risk = []

        for feature, shap_value in top_features:

            item = {
                "feature": feature,
                "label": self.friendly_name(feature),
                "value": student_data.get(feature),
                "shap_value": float(shap_value),
                "absolute_importance": float(
                    abs(shap_value)
                ),
            }

            # Positive SHAP = pushes toward High Risk
            if shap_value > 0:
                increasing_risk.append(item)
            else:
                reducing_risk.append(item)

        # Get real prediction too
        prediction = model_service.predict_one(
            student_data
        )

        # Real SHAP baseline for the High-Risk class
        expected_value = self.explainer.expected_value
        expected_array = np.asarray(expected_value).reshape(-1)
        base_raw = float(expected_array[-1])

        # XGBoost SHAP uses raw log-odds by default.
        # Convert the baseline to probability for the dashboard.
        base_probability = float(
            1.0 / (1.0 + np.exp(-base_raw))
        )

        return {
            "prediction": prediction,
            "baseline_probability": base_probability,
            "top_factors": [
                {
                    "feature": feature,
                    "label": self.friendly_name(feature),
                    "value": student_data.get(feature),
                    "shap_value": float(shap_value),
                    "absolute_importance": float(
                        abs(shap_value)
                    ),
                }
                for feature, shap_value
                in top_features
            ],
            "increasing_risk": increasing_risk,
            "reducing_risk": reducing_risk,
            "disclaimer": (
                "These factors influenced the model "
                "prediction. They do not prove the cause "
                "of the student's academic outcome."
            ),
        }


explainability_service = ExplainabilityService()