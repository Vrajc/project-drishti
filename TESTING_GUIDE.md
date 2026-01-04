# Testing Guide for Crowd Flow Analysis

## Prerequisites
- MongoDB running on localhost:27017
- Backend server running on port 5000
- Frontend running on port 5173
- Python 3.8+ with OpenCV installed

## Step-by-Step Testing

### 1. Setup Environment

```bash
# Install Python dependencies
cd backend
pip install -r requirements.txt

# Install Node dependencies
npm install
cd ../frontend
npm install
```

### 2. Start Services

```bash
# Terminal 1 - MongoDB (if not running as service)
mongod

# Terminal 2 - Backend
cd backend
npm run dev

# Terminal 3 - Frontend
cd frontend
npm run dev
```

### 3. Create Test Event with Zones

Login as organizer and create event with zones:

```javascript
// Example zones structure
{
  zones: [
    {
      id: "zone-1",
      name: "Main Entrance",
      coordinates: [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 150 },
        { x: 0, y: 150 }
      ],
      maxCapacity: 200
    },
    {
      id: "zone-2",
      name: "Concert Area",
      coordinates: [
        { x: 200, y: 0 },
        { x: 500, y: 0 },
        { x: 500, y: 300 },
        { x: 200, y: 300 }
      ],
      maxCapacity: 500
    },
    {
      id: "zone-3",
      name: "Food Court",
      coordinates: [
        { x: 0, y: 150 },
        { x: 200, y: 150 },
        { x: 200, y: 300 },
        { x: 0, y: 300 }
      ],
      maxCapacity: 150
    }
  ]
}
```

### 4. Test Video Upload

#### Using UI:
1. Navigate to event's Crowd Flow Analysis page
2. Click "Select Video File"
3. Choose a test video (people walking in various areas)
4. Click "Upload & Analyze"
5. Observe upload status message

#### Using API (curl):
```bash
# Get your auth token first
TOKEN="your_jwt_token_here"
EVENT_ID="your_event_id_here"

# Upload video
curl -X POST http://localhost:5000/api/crowd-analysis/process \
  -H "Authorization: Bearer $TOKEN" \
  -F "video=@test_video.mp4" \
  -F "eventId=$EVENT_ID" \
  -F "cameraId=camera-1" \
  -F "cameraName=Main Camera" \
  -F "sampleInterval=15"
```

### 5. Verify Processing

Check backend console for Python script output:
```
Processing video: uploads/videos/video-xxx.mp4
FPS: 30, Total frames: 3600
Sampling every 15 seconds (450 frames)
Processed frame 0/3600 at 0:00:00
Processed frame 450/3600 at 0:00:15
...
Processing complete. Generated 24 records.
```

### 6. Verify Data in MongoDB

```bash
# Connect to MongoDB
mongo drishti

# Check crowd density collection
db.crowddensities.find().pretty()

# Expected output:
{
  "_id": ObjectId("..."),
  "eventId": "event123",
  "zoneId": "zone-1",
  "zoneName": "Main Entrance",
  "peopleCount": 30,
  "densityPercentage": 15,
  "timestamp": ISODate("2026-01-03T14:10:20.000Z"),
  "videoTimestamp": "1:10:20",
  "cameraId": "camera-1",
  "cameraName": "Main Camera",
  "metadata": {
    "frameNumber": 2100,
    "confidence": 0.85,
    "processingTime": 0
  }
}
```

### 7. Test API Endpoints

```bash
# Get latest density
curl http://localhost:5000/api/crowd-analysis/$EVENT_ID/latest \
  -H "Authorization: Bearer $TOKEN"

# Get all density data for a zone
curl "http://localhost:5000/api/crowd-analysis/$EVENT_ID/density?zoneId=zone-1" \
  -H "Authorization: Bearer $TOKEN"

# Get zone statistics
curl http://localhost:5000/api/crowd-analysis/$EVENT_ID/zones/zone-1/statistics \
  -H "Authorization: Bearer $TOKEN"

# Get heatmap data
curl http://localhost:5000/api/crowd-analysis/$EVENT_ID/heatmap \
  -H "Authorization: Bearer $TOKEN"

# Get event zones
curl http://localhost:5000/api/crowd-analysis/$EVENT_ID/zones \
  -H "Authorization: Bearer $TOKEN"
```

### 8. Test Frontend Display

1. **Live Monitor**:
   - Verify density cards appear for each zone
   - Check color coding (green/yellow/red)
   - Verify people count displays
   - Check video timestamp shows
   - Verify auto-refresh works (30s)

2. **Zone Selection**:
   - Click on a zone card
   - Verify statistics panel appears
   - Check avg, peak, min values
   - Verify data points count

3. **Timeline View**:
   - With zone selected, check timeline appears
   - Verify historical data shows
   - Check timestamps are correct
   - Verify density bars display correctly

### 9. Test Edge Cases

#### Empty Event (No Zones)
- Try uploading video for event with no zones
- Should get error message

#### Invalid Video Format
- Try uploading non-video file
- Should get validation error

#### Large Video
- Upload large video (>100MB)
- Verify background processing works
- Check processing doesn't block other requests

#### No Data Yet
- View page before uploading any video
- Should show "No crowd data available yet" message

#### Auto-refresh Toggle
- Disable auto-refresh
- Wait 30+ seconds
- Verify data doesn't update automatically
- Enable auto-refresh
- Verify updates resume

## Sample Test Video

If you don't have test footage, you can:

1. **Use Sample Videos**: Find public domain crowd videos
   - Search: "crowd walking video free"
   - Download short clips (1-2 minutes)

2. **Create Test Video**: Record with phone
   - Film people walking in different areas
   - Keep video short for faster testing
   - 30-60 seconds is sufficient

3. **Use Stock Footage**: Sites like Pexels, Pixabay
   - Free crowd/people videos
   - Good quality for testing

## Expected Results

### Data Flow:
```
Video Upload → Python Processing → MongoDB Storage → API → Frontend Display
```

### Timestamp Format:
```
"at 0:00:15 - 30 people in zone A"
"at 0:00:30 - 35 people in zone A"
"at 0:00:45 - 40 people in zone A"
```

### Density Calculation:
```
Density % = (People Count / Max Capacity) * 100
Example: 30 people / 200 capacity = 15%
```

## Troubleshooting Tests

### Python Script Fails
```bash
# Test Python installation
python --version

# Test OpenCV
python -c "import cv2; print(cv2.__version__)"

# Test script directly
cd backend/src/services
python crowd_analyzer.py "test.mp4" '[{"id":"zone-1","name":"Test","coordinates":[{"x":0,"y":0}],"maxCapacity":100}]' "event123" 15
```

### Video Upload Fails
- Check uploads folder exists: `backend/uploads/videos`
- Verify multer configuration
- Check file size limits
- Verify video format

### No Data Showing
- Check MongoDB connection
- Verify data was inserted: `db.crowddensities.count()`
- Check API responses in network tab
- Verify event ID matches

### Frontend Errors
- Check browser console
- Verify API URL in service
- Check authentication token
- Verify event context

## Performance Testing

### Small Video (1 min, 720p)
- Expected processing time: ~1-2 minutes
- Expected data points: 4 (15s intervals)
- Expected memory usage: < 200MB

### Medium Video (5 min, 1080p)
- Expected processing time: ~5-10 minutes
- Expected data points: 20
- Expected memory usage: < 500MB

### Large Video (30 min, 1080p)
- Expected processing time: ~30-60 minutes
- Expected data points: 120
- Expected memory usage: < 1GB

## Success Criteria

✅ Video uploads successfully
✅ Python script processes without errors
✅ Data stored in MongoDB with correct format
✅ API returns data correctly
✅ Frontend displays density cards
✅ Color coding works (green/yellow/red)
✅ Zone selection shows statistics
✅ Timeline displays historical data
✅ Auto-refresh updates every 30s
✅ Timestamps match format: "at H:MM:SS"

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Python not found | Add Python to PATH or use full path |
| OpenCV not installed | `pip install opencv-python` |
| Upload folder missing | Create `backend/uploads/videos` |
| MongoDB connection failed | Start MongoDB service |
| No data showing | Check event has zones defined |
| Processing takes too long | Use smaller video or lower resolution |
| Memory issues | Process videos in smaller chunks |

## Clean Up After Testing

```bash
# Remove test videos
rm backend/uploads/videos/*

# Clear test data from MongoDB
mongo drishti
db.crowddensities.deleteMany({})

# Stop services
# Ctrl+C in each terminal
```

## Next Steps After Testing

1. Test with real event footage
2. Calibrate zone coordinates to actual venue
3. Adjust maxCapacity values based on real capacity
4. Fine-tune sample interval based on needs
5. Monitor performance with production-size videos
6. Set up alerts for high density zones
7. Export reports for post-event analysis
