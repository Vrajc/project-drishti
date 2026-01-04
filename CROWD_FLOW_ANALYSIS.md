# Crowd Flow Analysis Feature

## Overview
This feature provides real-time crowd density monitoring using OpenCV-powered video analysis. It processes video footage from event cameras, detects people, and tracks crowd density per zone with timestamped data.

## Features
- 🎥 **Video Upload**: Upload camera footage for analysis
- 👥 **People Detection**: Uses OpenCV HOG detector for person detection
- 📊 **Zone-based Analysis**: Track crowd density across multiple zones
- ⏱️ **Timestamped Data**: Extract data every 15 seconds (configurable)
- 📈 **Real-time Dashboard**: View live density percentages per zone
- 📉 **Historical Analytics**: View density trends over time
- 🔄 **Auto-refresh**: Automatically update dashboard every 30 seconds

## Architecture

### Backend Components

#### 1. Database Model (`crowdDensity.model.ts`)
```typescript
{
  eventId: string,
  zoneId: string,
  zoneName: string,
  peopleCount: number,
  densityPercentage: number,
  timestamp: Date,
  videoTimestamp: string, // "HH:MM:SS"
  cameraId?: string,
  cameraName?: string
}
```

#### 2. Python Analysis Service (`crowd_analyzer.py`)
- Uses OpenCV HOG (Histogram of Oriented Gradients) detector
- Detects people in video frames
- Counts people within defined zones
- Calculates density percentages
- Outputs timestamped JSON data

#### 3. Node.js Service (`crowdAnalysis.service.ts`)
- Interfaces with Python script
- Processes video uploads
- Stores results in MongoDB
- Provides analytics queries

#### 4. API Endpoints (`crowdAnalysis.routes.ts`)
```
POST   /api/crowd-analysis/process
GET    /api/crowd-analysis/:eventId/density
GET    /api/crowd-analysis/:eventId/latest
GET    /api/crowd-analysis/:eventId/zones/:zoneId/statistics
GET    /api/crowd-analysis/:eventId/heatmap
GET    /api/crowd-analysis/:eventId/zones
```

### Frontend Components

#### 1. Service (`crowdAnalysis.service.ts`)
- API communication layer
- Handles video uploads
- Fetches density data

#### 2. Page (`CrowdFlowAnalysis.tsx`)
- Video upload interface
- Real-time density cards
- Zone statistics display
- Historical timeline
- Auto-refresh functionality

## Installation

### Prerequisites
- Node.js 18+
- Python 3.8+
- MongoDB
- OpenCV

### Backend Setup

1. **Install Python Dependencies**
```bash
cd backend
pip install -r requirements.txt
```

2. **Install Node Dependencies**
```bash
npm install
```

3. **Environment Variables**
Add to `.env`:
```
MONGODB_URI=mongodb://localhost:27017/drishti
PORT=5000
```

4. **Start Backend**
```bash
npm run dev
```

### Frontend Setup

1. **Install Dependencies**
```bash
cd frontend
npm install
```

2. **Start Frontend**
```bash
npm run dev
```

## Usage

### 1. Setup Event with Zones

When creating an event, define zones with coordinates:
```typescript
{
  zones: [
    {
      id: "zone-1",
      name: "Main Entrance",
      coordinates: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ],
      maxCapacity: 200
    }
  ]
}
```

### 2. Upload Video Footage

1. Navigate to Crowd Flow Analysis page
2. Click "Select Video File"
3. Choose video from event camera
4. Click "Upload & Analyze"
5. Wait for processing (runs in background)

### 3. View Results

- **Live Monitor**: Shows latest density for each zone
- **Zone Details**: Click a zone card to see detailed statistics
- **Timeline**: View historical density changes
- **Auto-refresh**: Toggle to enable/disable automatic updates

## Data Format

### Stored Data Example
```json
{
  "eventId": "event123",
  "zoneId": "zone-1",
  "zoneName": "Main Entrance",
  "peopleCount": 30,
  "densityPercentage": 15,
  "timestamp": "2026-01-03T14:10:20.000Z",
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

### Timeline Example
```
at 1:10:20 - 30 people in zone A (15%)
at 1:10:35 - 35 people in zone A (17.5%)
at 1:10:50 - 40 people in zone A (20%)
```

## API Examples

### Upload Video
```bash
curl -X POST http://localhost:5000/api/crowd-analysis/process \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "video=@event_footage.mp4" \
  -F "eventId=event123" \
  -F "cameraId=camera-1" \
  -F "cameraName=Main Camera" \
  -F "sampleInterval=15"
```

### Get Latest Density
```bash
curl http://localhost:5000/api/crowd-analysis/event123/latest \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Zone Statistics
```bash
curl "http://localhost:5000/api/crowd-analysis/event123/zones/zone-1/statistics" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Performance Considerations

### Video Processing
- **Sample Interval**: Default 15 seconds (configurable)
- **Processing Time**: ~1-2 minutes per minute of video
- **Background Processing**: Upload returns immediately, processing happens async
- **Storage**: Processed videos can be deleted after analysis

### Optimization Tips
1. Use compressed video formats (MP4 recommended)
2. Lower resolution videos process faster (720p optimal)
3. Adjust sample interval based on event needs
4. Clean up old density data periodically

## Troubleshooting

### Python Script Not Found
Ensure Python is in system PATH:
```bash
python --version  # Should show Python 3.8+
```

### OpenCV Installation Issues
```bash
pip install --upgrade opencv-python
```

### Video Upload Fails
- Check file size limit (500MB default)
- Verify supported formats: .mp4, .avi, .mov, .mkv, .webm
- Check disk space for uploads folder

### No Density Data Showing
1. Verify zones are defined in event setup
2. Check video processing completed successfully
3. Check MongoDB connection
4. Verify API endpoints are accessible

## Future Enhancements

- [ ] Real-time camera stream processing
- [ ] Advanced ML models (YOLO, Faster R-CNN)
- [ ] Crowd flow direction tracking
- [ ] Predictive analytics with AI
- [ ] Heat map visualization on venue map
- [ ] Alert system for overcrowding
- [ ] Multi-camera synchronization
- [ ] Export reports to PDF

## Technical Details

### OpenCV HOG Detector
- **Method**: Histogram of Oriented Gradients
- **Accuracy**: ~85% in controlled environments
- **Speed**: ~10-15 FPS on standard hardware
- **Limitations**: Occluded people may not be detected

### Zone Detection Algorithm
- Uses point-in-polygon ray casting
- Center point of bounding box determines zone
- First matching zone is selected (no overlap)

### Performance Metrics
- **Detection Confidence**: Stored per frame
- **Processing Time**: Tracked per frame
- **Frame Numbers**: Stored for reference

## Support

For issues or questions:
1. Check troubleshooting section
2. Review logs in backend console
3. Check Python script output
4. Verify MongoDB records

## License

Part of Drishti Event Safety Platform
