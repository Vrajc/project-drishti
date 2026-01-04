# 🚀 Deployment Configuration

## Production URLs

- **Frontend (Vercel):** https://project-drishti-seven.vercel.app
- **Backend (Render):** https://project-drishti-805d.onrender.com

---

## ✅ Configuration Status

### Frontend Configuration
✅ `.env.production` configured with backend API URL

### Backend Configuration
✅ `.env` configured with frontend URL for CORS
✅ CORS middleware allows production frontend

---

## 🔄 Deployment Steps

### Backend (Render)

1. **Set Environment Variables in Render Dashboard:**
   - Go to: https://dashboard.render.com
   - Select your service: `project-drishti`
   - Go to "Environment" tab
   - Add these variables:

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://vrajc494:VrajmongoDB@cluster0.7yfpgvm.mongodb.net/drishti-event-safety
JWT_SECRET=9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
JWT_EXPIRE=7d
GEMINI_API_KEY=AIzaSyAqoyLojp08XAeKQHbB_vL_ZGTYmO50D1w
FRONTEND_URL=https://project-drishti-seven.vercel.app
```

2. **Trigger Redeploy:**
   - Push to GitHub (will auto-deploy)
   - Or click "Manual Deploy" → "Deploy latest commit"

3. **Verify Deployment:**
   ```bash
   curl https://project-drishti-805d.onrender.com/health
   ```
   Should return: `{"status":"OK","message":"Server is running"}`

---

### Frontend (Vercel)

1. **Set Environment Variables in Vercel Dashboard:**
   - Go to: https://vercel.com/dashboard
   - Select your project: `project-drishti`
   - Go to "Settings" → "Environment Variables"
   - Add this variable for **Production**:

```env
VITE_API_URL=https://project-drishti-805d.onrender.com/api
```

2. **Redeploy:**

   **Option A: Push to GitHub**
   ```bash
   git add .
   git commit -m "Update production configuration"
   git push origin main
   ```
   Vercel will auto-deploy from GitHub.

   **Option B: Manual Deploy**
   ```bash
   cd frontend
   npm run build
   vercel --prod
   ```

3. **Verify Deployment:**
   - Visit: https://project-drishti-seven.vercel.app
   - Try logging in - should connect to Render backend

---

## 🔍 Troubleshooting

### Issue: Login still failing

**Check 1: Backend is running**
```bash
curl https://project-drishti-805d.onrender.com/health
```

**Check 2: CORS headers**
- Open browser DevTools (F12)
- Go to Network tab
- Try logging in
- Check if request to backend shows CORS error

**Check 3: Environment variables set**
- Render Dashboard → Environment → Verify FRONTEND_URL
- Vercel Dashboard → Settings → Environment Variables → Verify VITE_API_URL

**Check 4: Redeploy after env changes**
- Environment variable changes require redeployment
- Render: Manual redeploy or push to GitHub
- Vercel: Redeploy from dashboard or push to GitHub

---

### Issue: Render backend sleeping (free tier)

Render free tier puts services to sleep after 15 minutes of inactivity:
- First request takes 30-60 seconds to wake up
- Consider keeping it awake with a cron job (ping every 10 minutes)
- Or upgrade to paid plan for always-on

**Keep-alive solution:**
```bash
# Use a service like cron-job.org to ping:
# https://project-drishti-805d.onrender.com/health
# Every 10 minutes
```

---

## 📋 Deployment Checklist

Backend (Render):
- [ ] All environment variables set
- [ ] FRONTEND_URL points to Vercel URL
- [ ] Service is running (green status)
- [ ] Health endpoint accessible
- [ ] MongoDB connection working

Frontend (Vercel):
- [ ] VITE_API_URL environment variable set
- [ ] Points to Render backend URL with /api
- [ ] Deployment successful
- [ ] Site loads correctly
- [ ] Can connect to backend

---

## 🔄 Future Updates

### Update Backend:
```bash
cd backend
# Make changes
git add .
git commit -m "Update backend"
git push origin main
# Render will auto-deploy
```

### Update Frontend:
```bash
cd frontend
# Make changes
git add .
git commit -m "Update frontend"
git push origin main
# Vercel will auto-deploy
```

### Update Both:
```bash
# From root directory
git add .
git commit -m "Update both frontend and backend"
git push origin main
# Both will auto-deploy
```

---

## 🌐 Accessing Your App

- **Live Site:** https://project-drishti-seven.vercel.app
- **API Health:** https://project-drishti-805d.onrender.com/health
- **API Base:** https://project-drishti-805d.onrender.com/api

---

## 🔒 Security Notes

⚠️ **Important:** Your `.env` file contains sensitive credentials and is already in `.gitignore`.

For production:
1. ✅ Environment variables stored securely in Render/Vercel dashboards
2. ✅ Credentials not in GitHub repository
3. ✅ CORS restricted to your frontend domain
4. ⚠️ Consider rotating JWT_SECRET and API keys regularly
5. ⚠️ Use MongoDB IP whitelist or VPC for additional security

---

## 📊 Monitoring

### Backend Logs (Render):
- Dashboard → Logs tab
- Real-time server logs
- Error tracking

### Frontend Analytics (Vercel):
- Dashboard → Analytics
- Page views and performance
- Error tracking with Vercel Analytics

---

<div align="center">

**🎉 Your app is now live in production! 🎉**

Frontend: [project-drishti-seven.vercel.app](https://project-drishti-seven.vercel.app)  
Backend: [project-drishti-805d.onrender.com](https://project-drishti-805d.onrender.com)

</div>
