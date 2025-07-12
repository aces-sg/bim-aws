FROM python:3.10-slim

RUN apt-get update && apt-get install -y software-properties-common

WORKDIR /app

COPY main.py .
COPY api.py .
COPY requirements.txt .

RUN pip install -r requirements.txt

EXPOSE 8069

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8069"]
