# Sri Lanka Life Expectancy Explorer

An interactive machine learning dashboard for exploring how health and lifestyle factors relate to **simulated age of death** in a synthetic Sri Lankan cohort. Enter a profile to get an estimate, inspect the model explanation, and compare model performance in one place.

> **For learning and demonstration only.** The project uses synthetic data. Predictions are not medical advice and are not real life expectancy estimates.

<!-- Add a screenshot of the frontend here (for example, save it as docs/frontend-screenshot.png). -->
<img width="1904" height="950" alt="image" src="https://github.com/user-attachments/assets/271be391-f08b-40a6-90cf-351c504ef7f8" />

<img width="1888" height="953" alt="image" src="https://github.com/user-attachments/assets/9c045af6-4fa5-4b08-b6c5-a136a58cd35c" />


## What’s inside

- **Frontend:** React 18, TypeScript, Vite, and Recharts. The dashboard includes a prediction form, model comparison, and visual summaries.
- **Backend:** Python and FastAPI serve the trained models and dashboard data through a small JSON API.
- **Machine learning:** Explainable Boosting Machine (EBM) is the primary model, compared with Random Forest and LightGBM. The training pipeline uses preprocessing, a validation-based EBM parameter search, and train/validation/test splits.
- **Interpretability and evaluation:** EBM feature contributions, feature importance, partial dependence, group error summaries, and standard regression metrics (MAE, RMSE, and R²). SHAP is also used to create a LightGBM summary plot during training.
- **Data:** The training script downloads the synthetic Sri Lankan health cohort from Kaggle using `kagglehub`.

## Prerequisites

- Python 3.10 or newer
- Node.js 18 or newer and npm
- Internet access for the training script to download the dataset

## Run the project

Use two terminals from the project root: one for the API and one for the dashboard. The first run also needs model training; it downloads the dataset and writes model files and evaluation artifacts to `backend/artifacts/`.

### 1. Set up and train the backend

From the project root, create and activate a virtual environment, install the dependencies, and train the models:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python train.py
```

Training may take a while. When it completes, start the API in the same terminal:

```powershell
uvicorn main:app --reload --port 8000
```

The API is available at <http://localhost:8000>; interactive API documentation is at <http://localhost:8000/docs>.

### 2. Start the frontend

In a second terminal, from the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal (typically <http://localhost:5173>). The frontend connects to the API at `http://localhost:8000` by default. To use another API URL, create `frontend/.env.local` with:

```env
VITE_API_URL=http://localhost:8000
```

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | API status and loaded models |
| `GET` | `/schema` | Feature names, valid values, and numeric ranges |
| `GET` | `/metrics` | Model scores, feature importance, partial dependence, and group error summaries |
| `GET` | `/holdout` | A held-out sample profile for the dashboard demo |
| `POST` | `/predict` | Generate a prediction for the supplied features and optional model |

## Project layout

```text
health-ml/
├── backend/
│   ├── train.py          # Download data, train models, and build artifacts
│   ├── main.py           # FastAPI application
│   ├── requirements.txt  # Python dependencies
│   └── artifacts/        # Generated models, schema, metrics, and plots
└── frontend/
    ├── src/              # React dashboard and API client
    └── package.json      # Frontend scripts and dependencies
```

## Build the frontend

To create a production build:

```powershell
cd frontend
npm run build
```

The compiled files are written to `frontend/dist/`.
