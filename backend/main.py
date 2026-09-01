from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from model_service import model_service
from explainability import explainability_service
from typing import Any
import pandas as pd
import io
import logging
import os

IS_VERCEL = bool(os.getenv("VERCEL"))

from persistence import (
    save_latest_state,
    load_latest_state,
)

logger = logging.getLogger("eduguard")

MAX_CSV_BYTES = 4 * 1024 * 1024

# -------------------------------------------------
# Latest uploaded cohort
# -------------------------------------------------

# -------------------------------------------------
# Load last saved cohort when backend starts
# -------------------------------------------------

latest_cohort_df, latest_predictions = (
    load_latest_state()
)

# -------------------------------------------------
# Create EduGuard FastAPI application
# -------------------------------------------------

app = FastAPI(
    title="EduGuard API",
    description="Backend API for EduGuard Academic Risk Detection System",
    version="1.0.0",
)


# -------------------------------------------------
# Allow the React frontend to communicate
# with this Python backend
# -------------------------------------------------

origins = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "https://edu-guard-academic-risk-detection.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------------------------
# Basic root endpoint
# -------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "EduGuard backend is running"
    }


# -------------------------------------------------
# Health-check endpoint
# -------------------------------------------------

@app.get("/api/eduguard/health")
def health_check():
    return {
        "status": "ok" if model_service.ready else "error",
        "service": "EduGuard Backend",
        "version": "1.0.0",
        "model_status": (
            "Loaded"
            if model_service.ready
            else "Failed to load"
        ),
        "model": model_service.get_status(),
    }

# -------------------------------------------------
# Get required model features
# -------------------------------------------------

@app.get("/api/eduguard/features")
def get_model_features():
    return {
        "number_of_features": len(model_service.feature_names),
        "features": model_service.feature_names,
    }


# -------------------------------------------------
# Predict one student
# -------------------------------------------------

@app.post("/api/eduguard/predict")
def predict_student(student: dict[str, Any]):
    try:
        result = model_service.predict_one(student)

        return {
            "status": "success",
            "result": result,
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception as error:
        logger.exception("Unexpected single-student prediction error")
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to generate the prediction. "
                "Please verify the input and try again."
            )
        )

# -------------------------------------------------
# Predict students from uploaded CSV
# -------------------------------------------------

@app.post("/api/eduguard/predict-csv")
async def predict_csv(file: UploadFile = File(...)):
    
    try:
        # Only allow CSV
        filename = file.filename or ""

        if not filename.lower().endswith(".csv"):
            raise HTTPException(
                status_code=400,
                detail="Please upload a CSV file."
            )

        contents = await file.read()

        if len(contents) > MAX_CSV_BYTES:
            raise HTTPException(
                status_code=413,
                detail="CSV file is too large. Maximum size is 4 MB."
            )

        dataframe = pd.read_csv(
            io.BytesIO(contents)
        )

        if dataframe.empty:
            raise HTTPException(
                status_code=400,
                detail="The uploaded CSV file is empty."
            )

        results = model_service.predict_batch(dataframe)

        global latest_cohort_df, latest_predictions

        latest_cohort_df = dataframe.copy()

        dashboard_results = []

        for index, result in enumerate(results):
            row = dataframe.iloc[index]

            dashboard_results.append({
                "student_id": str(
                    row["id_student"]
                    if "id_student" in dataframe.columns
                    else index + 1
                ),

                "code_module": (
                    str(row["code_module"])
                    if "code_module" in dataframe.columns
                    else None
                ),

                "code_presentation": (
                    str(row["code_presentation"])
                    if "code_presentation" in dataframe.columns
                    else None
                ),

                "risk_level": result["risk_label"],
                "risk_probability": result["risk_probability"],

                "assessment_completion_rate": float(
                    row["assessment_completion_rate"]
                ),

                "mean_assessment_score": float(
                    row["mean_assessment_score"]
                ),

                "last_activity_day": float(
                    row["last_activity_day"]
                ),

                "active_weeks": float(
                    row["active_weeks"]
                ),

                "late_submissions": float(
                    row["late_submission_count"]
                ),

                "studied_credits": float(
                    row["studied_credits"]
                ),

                "weekly_activity": [
                    float(row[f"week_{week}_clicks"])
                    for week in range(1, 9)
                ],
            })

        latest_predictions = dashboard_results
        
        save_latest_state(
            latest_cohort_df,
            latest_predictions
        )

        return {
            "status": "success",
            "total_students": len(dashboard_results),
            "results": dashboard_results,
        }

    except HTTPException:
        raise

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception as error:
        logger.exception("Unexpected CSV prediction error")
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to process the uploaded cohort. "
                "Please verify the CSV and try again."
            )
        )

# -------------------------------------------------
# Explain one student prediction using SHAP
# -------------------------------------------------

@app.post("/api/eduguard/explain")
def explain_student(student: dict[str, Any]):
    try:
        explanation = (
            explainability_service.explain_one(
                student,
                top_n=10
            )
        )

        return {
            "status": "success",
            "explanation": explanation,
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception as error:
        logger.exception("Unexpected SHAP explanation error")
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to generate the explanation. "
                "Please verify the student data and try again."
            )
        )

# -------------------------------------------------
# Model information
# -------------------------------------------------

@app.get("/api/eduguard/model-info")
def get_model_info():
    return {
        "model_name": "XGBoost",
        "system_name": "EduGuard",
        "prediction_window": "First 8 Weeks / 56 Days",

        "target_definition": {
            "0": "Lower Risk - Pass or Distinction",
            "1": "High Risk - Fail or Withdrawn"
        },

        "number_of_features": len(
            model_service.feature_names
        ),

        "metrics": {
            "accuracy": 0.8042,
            "precision": 0.8506,
            "recall": 0.7584,
            "f1_score": 0.8018,
            "roc_auc": 0.8870,
            "pr_auc": 0.9110
        },

        "confusion_matrix": {
            "true_negative": 1981,
            "false_positive": 338,
            "false_negative": 613,
            "true_positive": 1924
        },

        "limitations": [
            "The model was developed using the OULAD dataset.",
            "Predictions use information from the first 8 weeks.",
            "The binary target simplifies academic outcomes.",
            "Some genuinely high-risk students may be predicted as lower risk.",
            "SHAP explanations describe model behaviour and do not prove causality.",
            "The system should support academic judgement, not replace it."
        ],

        "decision_support_notice": (
            "EduGuard is a decision-support system. "
            "Predictions should not be used as the sole "
            "basis for academic decisions about students."
        )
    }

# -------------------------------------------------
# Get latest cohort predictions
# -------------------------------------------------

@app.get("/api/eduguard/predictions")
def get_predictions():
    return {
        "status": "success",
        "total_students": len(latest_predictions),
        "results": latest_predictions,
    }

# -------------------------------------------------
# Get one student's prediction
# -------------------------------------------------

@app.get("/api/eduguard/predictions/{student_id}")
def get_student_prediction(student_id: str):

    for student in latest_predictions:
        if student["student_id"] == str(student_id):
            return {
                "status": "success",
                "result": student,
            }

    raise HTTPException(
        status_code=404,
        detail="Student not found."
    )

# -------------------------------------------------
# Explain a saved student by ID
# -------------------------------------------------

@app.get("/api/eduguard/explanations/{student_id}")
def get_student_explanation(student_id: str):
    try:
        if latest_cohort_df is None:
            raise HTTPException(
                status_code=404,
                detail="No cohort has been uploaded yet."
            )

        if "id_student" not in latest_cohort_df.columns:
            raise HTTPException(
                status_code=400,
                detail="Uploaded cohort does not contain id_student."
            )

        matches = latest_cohort_df[
            latest_cohort_df["id_student"].astype(str)
            == str(student_id)
        ]

        if matches.empty:
            raise HTTPException(
                status_code=404,
                detail="Student not found."
            )

        student_data = matches.iloc[0].to_dict()

        explanation = explainability_service.explain_one(
            student_data,
            top_n=10
        )

        return {
            "status": "success",
            "student_id": str(student_id),
            "explanation": explanation,
        }

    except HTTPException:
        raise

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception:
        logger.exception(
            "Unexpected saved-student explanation error"
        )
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to generate the explanation for this student. "
                "Please try again."
            )
        )