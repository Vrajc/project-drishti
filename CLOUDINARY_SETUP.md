# Event Database and Cloudinary Integration Setup

## What Was Implemented

### 1. Backend Updates

#### Event Model (`backend/src/models/event.model.ts`)
- **Completely restructured** to match frontend event structure
- **New fields added:**
  - `name`, `type`, `date`, `time`, `crowdSize`, `location`, `description`
  - `zones`: Array of zone names
  - `cameras`: Array of camera objects with id, name, location, ipAddress, rtspUrl
  - `dispatchUnits`: Array of emergency units with id, name, type, contact, capacity, location
  - `mapFile`: String URL to Cloudinary-hosted map file
  - `organizerEmail`: **Email of the organizer** (for querying events by organizer)
  - `organizerId`: User ID of organizer
  - `organizerName`: Name of organizer
  - `registeredUsers`: Array of registered user IDs
  - `image`: Event thumbnail image URL

#### Cloudinary Configuration (`backend/src/config/cloudinary.ts`)
- Configured with provided credentials:
  - API Key: `511897582626923`
  - API Secret: `hY2fF146PM0H8bd4aNnYqWXklLA`
- **⚠️ IMPORTANT:** You need to add your `cloud_name` in this file
- Maps are uploaded to the `event-maps` folder in Cloudinary

#### Event Controller (`backend/src/controllers/event.controller.ts`)
- **Created comprehensive controller** with the following functions:
  - `createEvent`: Creates event and uploads map to Cloudinary (base64 → Cloudinary URL)
  - `getAllEvents`: Fetches all events
  - `getEventsByOrganizer`: Fetches events by organizer email
  - `getEventById`: Fetches single event
  - `updateEvent`: Updates event and re-uploads map if changed
  - `deleteEvent`: Deletes event
  - `registerForEvent`: Registers user for an event

#### Event Routes (`backend/src/routes/event.routes.ts`)
- **Updated all route handlers** to use controller functions
- Routes available:
  - `GET /api/events` - Get all events
  - `GET /api/events/organizer/:organizerEmail` - Get events by organizer email
  - `GET /api/events/:id` - Get single event
  - `POST /api/events` - Create event (protected, requires auth)
  - `PUT /api/events/:id` - Update event (protected, requires auth)
  - `DELETE /api/events/:id` - Delete event (protected, requires auth)
  - `POST /api/events/:id/register` - Register for event (protected, requires auth)

### 2. Frontend Updates

#### Event Service (`frontend/src/services/event.service.ts`)
- **New service file** for all event API calls
- **File upload handling:** Converts File objects to base64 for API transmission
- **Functions:**
  - `createEvent`: Posts event data with map file upload
  - `getAllEvents`: Fetches all events
  - `getEventsByOrganizer`: Fetches events by organizer email
  - `getEventById`: Fetches single event
  - `updateEvent`: Updates event with optional map re-upload
  - `deleteEvent`: Deletes event
  - `registerForEvent`: Registers user for event
- **Helper:** `fileToBase64` - Converts File to base64 string for transmission

#### Event Setup Page (`frontend/src/pages/EventSetup.tsx`)
- **Updated submission handler** to:
  - Call backend API instead of only localStorage
  - Include `organizerEmail` from user context
  - Handle map file upload via base64 encoding
  - Show loading state during submission
  - Display success/error messages
- **Submit button** now shows "Creating Event..." during processing
- **Error handling** for failed uploads or API errors

#### Event Context (`frontend/src/contexts/EventContext.tsx`)
- **Added API integration** while maintaining backward compatibility
- **New feature:** `refreshEvents()` function to fetch events from database
- **Auto-fetch on mount** - Loads events from database when app starts
- **Updated `getEventsByOrganizer`** to filter by `organizerEmail` instead of `organizerId`
- **Fallback to localStorage** if API fails (offline support)
- **mapFile field** now supports both File objects and Cloudinary URL strings

#### Organizer Dashboard (`frontend/src/pages/OrganizerDashboard.tsx`)
- **Updated** to use `user.email` instead of `user.id` for fetching organizer events

### 3. Package Dependencies
- **Installed:**
  - `cloudinary` - Cloudinary SDK for Node.js
  - `multer` - File upload middleware (available for future use if needed)

## How It Works

### Event Creation Flow:
1. **Organizer fills out event form** in EventSetup page
2. **Form data is collected** including zones, cameras, dispatch units, and map file
3. **On submit:**
   - Map file is converted to base64 string
   - Data is sent to `POST /api/events` with organizer email
   - Backend receives data and uploads map to Cloudinary
   - Cloudinary returns secure URL
   - Event is saved to MongoDB with map URL
   - Response returns complete event data with Cloudinary map URL
4. **Frontend receives response:**
   - Adds event to local EventContext for immediate UI update
   - Stores in localStorage as backup
   - Redirects to Organizer Dashboard

### Event Retrieval Flow:
1. **On app load:**
   - EventContext calls `refreshEvents()`
   - Fetches all events from database via API
   - Updates local state and localStorage
2. **Organizer Dashboard:**
   - Calls `getEventsByOrganizer(user.email)`
   - Filters events by organizer email
   - Displays only organizer's events
3. **Admin Dashboard:**
   - Calls `getAllEvents()`
   - Displays all events in the system

### Map File Storage:
- **Upload:** File → Base64 → API → Cloudinary → Secure URL → MongoDB
- **Retrieval:** MongoDB → API → Frontend displays Cloudinary URL
- **Folder:** All maps stored in `event-maps/` folder in Cloudinary
- **Format:** Supports images and PDFs (`image/*,.pdf`)

## Important Notes

### ⚠️ TODO: Add Cloudinary Cloud Name
You need to update `backend/src/config/cloudinary.ts` with your Cloudinary cloud name:

```typescript
cloudinary.config({
  cloud_name: 'YOUR_CLOUD_NAME_HERE', // ← Replace this
  api_key: '511897582626923',
  api_secret: 'hY2fF146PM0H8bd4aNnYqWXklLA',
});
```

### Database Connection
- Events are now stored in MongoDB
- Collection: `events`
- Make sure MongoDB is running before creating events

### Authentication
- Creating, updating, and deleting events requires authentication
- JWT token is automatically included from localStorage
- Organizer email is automatically captured from logged-in user

### Data Structure
Events now include complete configuration:
- Event details (name, type, date, time, location, crowd size)
- Zones (array of zone names)
- Cameras (full camera objects with RTSP URLs)
- Dispatch units (emergency response teams)
- Map file (Cloudinary URL)
- Organizer information (ID, email, name)

## Testing

### To test event creation:
1. Make sure MongoDB is running
2. Start backend: `cd backend && npm start`
3. Start frontend: `cd frontend && npm run dev`
4. Log in as organizer
5. Navigate to Event Setup
6. Fill out all fields
7. Upload a map file
8. Click "Start Safety Planning"
9. Check MongoDB for saved event
10. Check Cloudinary dashboard for uploaded map

### To verify:
- Event should appear in Organizer Dashboard
- Event should appear in Admin Dashboard
- Map file should be uploaded to Cloudinary
- Organizer email should be stored with event
- All zones, cameras, and dispatch units should be saved

## Benefits

1. **Persistent Storage:** Events are now saved to database, not just localStorage
2. **Cloud Storage:** Maps stored in Cloudinary, not local filesystem
3. **Multi-device Access:** Events accessible from any device
4. **Real Data Flow:** Admin can see all organizer events in real-time
5. **Scalability:** Database can handle thousands of events
6. **Reliability:** Cloudinary provides fast, global CDN for map files
7. **Organizer Tracking:** Events linked to organizer email for easy querying
