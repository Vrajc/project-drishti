# 🚨 Production Deployment Troubleshooting

## Common "Failed to Fetch" Error - SOLVED

### Root Causes:
1. ❌ Backend not running
2. ❌ Wrong API URL in frontend
3. ❌ CORS blocking requests
4. ❌ Firewall/Network issues

---

## ✅ SOLUTION CHECKLIST

### Step 1: Verify Backend is Running

```bash
cd backend
npm run dev

# Check if backend is accessible
curl http://localhost:5000/health
# Should return: {"status":"OK","message":"Server is running"}
```

### Step 2: Configure Frontend API URL

**For Local Production Testing:**

`frontend/.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

**For Actual Production (deployed):**

`frontend/.env.production`:
```env
# Update with your actual backend URL
VITE_API_URL=https://your-backend-domain.com/api
```

### Step 3: Configure Backend CORS

`backend/.env`:
```env
# Add your production frontend URL
FRONTEND_URL=https://your-frontend-domain.com
```

The backend is now configured to allow:
- All localhost ports (3000, 3001, 5173)
- Your production frontend URL from .env

### Step 4: Rebuild Frontend

```bash
cd frontend

# Development
npm run dev

# Production build
npm run build
npm run preview
```

---

## 🌐 Deployment Scenarios

### Scenario 1: Testing Locally (Both on localhost)

**Backend `.env`:**
```env
PORT=5000
FRONTEND_URL=http://localhost:3000
```

**Frontend `.env`:**
```env
VITE_API_URL=http://localhost:5000/api
```

**Run:**
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

---

### Scenario 2: Same Domain Deployment

If frontend and backend are on the same domain (e.g., Vercel, Netlify with serverless):

**Frontend `.env.production`:**
```env
VITE_API_URL=/api
```

**Backend `.env`:**
```env
FRONTEND_URL=https://yourdomain.com
```

---

### Scenario 3: Different Domains

**Example: Frontend on Vercel, Backend on Railway**

**Frontend `.env.production`:**
```env
VITE_API_URL=https://your-backend.railway.app/api
```

**Backend `.env`:**
```env
FRONTEND_URL=https://your-app.vercel.app
```

---

## 🔍 Debug Steps

### 1. Check Backend Connection
```bash
# Test backend health
curl http://localhost:5000/health

# Test login endpoint
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","role":"organizer"}'
```

### 2. Check Browser Console
Open DevTools (F12) → Network tab:
- Is the request being made?
- What's the request URL?
- What's the response status?
- Any CORS errors?

### 3. Verify Environment Variables
```bash
# In frontend directory
echo %VITE_API_URL%  # Windows
echo $VITE_API_URL   # Mac/Linux
```

**Important:** Environment variables must start with `VITE_` in Vite!

### 4. Check CORS Headers
In browser console:
```javascript
fetch('http://localhost:5000/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

---

## 🚀 Production Deployment Platforms

### Vercel (Frontend)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
cd frontend
vercel

# Set environment variable
vercel env add VITE_API_URL production
# Enter your backend URL
```

### Railway (Backend)
```bash
# Install Railway CLI
npm i -g @railway/cli

# Deploy backend
cd backend
railway login
railway init
railway up

# Set environment variables
railway variables set MONGODB_URI=your_mongodb_uri
railway variables set JWT_SECRET=your_jwt_secret
railway variables set GEMINI_API_KEY=your_api_key
```

### Render (Full Stack)
1. Connect GitHub repo
2. Create Web Service for backend
3. Create Static Site for frontend
4. Set environment variables in dashboard

---

## 🔒 Security Checklist for Production

- [ ] Use HTTPS for both frontend and backend
- [ ] Set `NODE_ENV=production` in backend
- [ ] Use environment variables for all secrets
- [ ] Enable CORS only for your frontend domain
- [ ] Use strong JWT_SECRET (32+ characters)
- [ ] Hide `.env` files (already in `.gitignore`)
- [ ] Use MongoDB connection with authentication
- [ ] Set up rate limiting (recommended)

---

## 📝 Quick Reference

**Frontend requires rebuild after .env changes:**
```bash
# Stop dev server (Ctrl+C)
# Restart
npm run dev
```

**Backend requires restart after .env changes:**
```bash
# Stop server (Ctrl+C)
# Restart
npm run dev
```

**Environment variables in Vite:**
- Must start with `VITE_`
- Access with `import.meta.env.VITE_VARIABLE_NAME`
- Rebuilt into app at build time (not runtime!)

---

## 🆘 Still Having Issues?

1. **Clear browser cache** - Hard refresh (Ctrl+Shift+R)
2. **Check firewall** - Allow ports 3000 and 5000
3. **Verify MongoDB** - Connection string is correct
4. **Check logs** - Backend terminal for error messages
5. **Test API directly** - Use Postman or curl
6. **Verify package versions** - Run `npm install` in both folders

---

## ✅ Working Configuration Example

**Project structure:**
```
drishti/
├── backend/
│   ├── .env (PORT=5000, FRONTEND_URL=http://localhost:3000)
│   └── src/server.ts (CORS configured ✓)
│
└── frontend/
    ├── .env (VITE_API_URL=http://localhost:5000/api)
    └── .env.production (VITE_API_URL=https://api.production.com/api)
```

**Run both:**
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

**Result:** ✅ Login should work at http://localhost:3000

---

<div align="center">

**Still stuck? Check backend is running on port 5000 first!**

</div>
