# Sri Lanka Life Expectancy Predictor (RF vs XGBoost)

health-ml/
├── backend/   train.py (creates artifacts/), main.py (FastAPI), requirements.txt
└── frontend/  React + TypeScript (Vite) dashboard

## Run
1. Train (once):      cd backend && python train.py
2. Start API:         pip install -r requirements.txt && uvicorn main:app --reload --port 8000
   Swagger docs:      http://localhost:8000/docs
3. Start dashboard:   cd frontend && npm install && npm run dev   ->  http://localhost:5173

## API
GET  /health   GET /schema   GET /metrics   GET /holdout
POST /predict  {"features": {...}, "model": "XGBoost" | null}
