# Dockerfile for a Flask JWT-protected application

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy app source and public files
COPY app.py ./
COPY ../public ./public

EXPOSE 3000

CMD ["python3", "-m", "uvicorn", "app:app", "--host=0.0.0.0", "--port=3000"]