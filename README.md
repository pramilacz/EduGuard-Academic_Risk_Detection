<img width="1920" height="874" alt="image" src="https://github.com/user-attachments/assets/25f8e7b2-0b3d-409b-ab47-95eb565f1a71" /># EduGuard

**Early Academic Risk Detection & Learning Analytics**

EduGuard is a final-year academic decision-support prototype that identifies students who may be at risk of **Failing or Withdrawing** using information from the **first 8 weeks / 56 days** of study.

**Preview:**
<img width="1920" height="874" alt="image" src="https://github.com/user-attachments/assets/ccab6e36-face-457b-b297-e867e714598b" />


The system combines:

- a React + TypeScript dashboard,
- a FastAPI backend,
- the final saved XGBoost classification pipeline,
- local SHAP explanations,
- CSV cohort scoring,
- persisted cohort/prediction state,
- model metrics and responsible-use information.

## Final model

- Model: **XGBoost**
- Prediction window: **First 8 Weeks / 56 Days**
- Input features: **45**
- Lower Risk: Pass or Distinction
- High Risk: Fail or Withdrawn
- F1-score: **80.18%**
- ROC-AUC: **88.70%**
- PR-AUC: **91.10%**

The model is loaded from:

```text
backend/models/final_ml_model.joblib
```

The exact model-input contract is stored in:

```text
backend/models/model_input_features.json
```

## Project structure

```text
EduGuard_Dashboard/
├── backend/
│   ├── main.py
│   ├── model_service.py
│   ├── explainability.py
│   ├── validation.py
│   ├── persistence.py
│   ├── phase10e_validation.py
│   ├── requirements.txt
│   ├── data/
│   └── models/
├── src/
│   ├── components/
│   ├── lib/eduguard/
│   └── routes/
├── package.json
└── README.md
```

## Backend setup

The saved sklearn pipeline was created with **scikit-learn 1.6.1**. Use the pinned versions in `backend/requirements.txt` so the serialized model is loaded with a compatible environment.

Recommended Python version: **Python 3.11**.

### Windows

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn main:app --reload
```

### macOS / Linux

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend URL:

```text
http://127.0.0.1:8000
```

Swagger documentation:

```text
http://127.0.0.1:8000/docs
```

Health endpoint:

```text
http://127.0.0.1:8000/api/eduguard/health
```

## Frontend setup

Open a second terminal in the project root:

```bash
npm install
npm run dev
```

The frontend uses this backend by default:

```text
http://127.0.0.1:8000/api/eduguard
```

To override it, create an environment variable:

```text
VITE_EDUGUARD_API_URL=http://127.0.0.1:8000/api/eduguard
```

## Using the dashboard

1. Start the FastAPI backend.
2. Start the React frontend.
3. Open **Overview**.
4. Use **Upload Cohort** to choose a CSV containing all 45 required model features.
5. EduGuard validates the CSV, runs the real XGBoost pipeline, saves the latest cohort and predictions, and refreshes the dashboard.
6. Use **Student Risk List** to filter and rank students.
7. Open **Student Profile** for individual risk and engagement information.
8. Open **Explainable AI** to view SHAP factors that increase or reduce the selected student's predicted risk.
9. Open **Model Information** to view the final metrics, confusion matrix, limitations and decision-support notice returned by FastAPI.

Optional identifier columns such as `id_student`, `code_module`, and `code_presentation` improve dashboard navigation but are not part of the 45-feature model input.

## Phase 10E final validation

With the backend virtual environment active, run:

```bash
cd backend
python phase10e_validation.py
```

A final local run should report all checks as **PASS**. The script validates:

- backend health and model loading,
- the 45-feature contract,
- persisted cohort/prediction integrity,
- saved prediction endpoints,
- single-student XGBoost prediction,
- SHAP explanation consistency,
- invalid-input rejection.

Frontend quality checks:

```bash
npm run lint
npm run build
```

## Persistence

The latest uploaded cohort and prediction results are stored in:

```text
backend/data/latest_cohort.csv
backend/data/latest_predictions.json
```

The backend reloads these files when it starts, allowing the most recent cohort to remain available after a restart. SHAP explanations are generated from the persisted cohort on demand.

## Responsible use

EduGuard is a **decision-support system**. Predictions should not be used as the sole basis for academic decisions about students.

SHAP explanations describe how model features influenced a prediction; they do **not** prove the cause of a student's academic outcome.
