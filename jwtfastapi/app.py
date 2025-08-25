from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import datetime
import os
from datetime import timezone

app = FastAPI()
app.secret_key = 'e9aae26be08551392be664d620fb422350a30349899fc254a0f37bfa1b945e36ff20d25b12025e1067f9b69e8b8f2ef0f767f6fff6279e5755668bf4bae88588'

users = {
    'CAB432': {
        'password': 'supersecret',
        'admin': False
    },
    'admin': {
        'password': 'admin',
        'admin': True
    }
}

security = HTTPBearer()

# Mount static files
directory_path = os.path.join(os.path.dirname(__file__), 'public')
app.mount("/public", StaticFiles(directory=directory_path), name="public")

def generate_access_token(username):
    payload = {
        'username': username,
        'exp': datetime.datetime.now(timezone.utc) + datetime.timedelta(minutes=30)
    }
    token = jwt.encode(payload, app.secret_key, algorithm='HS256')
    return token

def authenticate_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials or not credentials.scheme == 'Bearer':
        raise HTTPException(status_code=401, detail='Unauthorized')
    token = credentials.credentials
    try:
        user = jwt.decode(token, app.secret_key, algorithms=['HS256'])
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')

@app.post('/login')
async def login(request: Request):
    data = await request.json()
    username = data.get('username')
    password = data.get('password')
    user = users.get(username)
    if not user or user['password'] != password:
        raise HTTPException(status_code=401, detail='Unauthorized')
    token = generate_access_token(username)
    return { 'authToken': token }

@app.get('/')
async def main_page(user=Depends(authenticate_token)):
    return FileResponse(os.path.join(directory_path, 'index.html'))

@app.get('/admin')
async def admin_page(user=Depends(authenticate_token)):
    user_obj = users.get(user['username'])
    if not user_obj or not user_obj['admin']:
        raise HTTPException(status_code=403, detail='Unauthorised user requested admin content.')
    return FileResponse(os.path.join(directory_path, 'admin.html'))

# To run: uvicorn app:app --host 0.0.0.0 --port 3000
