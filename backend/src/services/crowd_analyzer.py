"""
Crowd Analysis Service using OpenCV
Detects people in video footage and tracks crowd density per zone
"""

import cv2
import numpy as np
from datetime import datetime, timedelta
import json
import sys
from typing import List, Dict, Tuple

class CrowdAnalyzer:
    def __init__(self):
        # Initialize HOG (Histogram of Oriented Gradients) person detector
        self.hog = cv2.HOGDescriptor()
        self.hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
        
        # More aggressive parameters for better detection
        self.detection_params = {
            'winStride': (4, 4),  # Smaller stride for more thorough detection
            'padding': (8, 8),    # More padding
            'scale': 1.03         # Smaller scale steps for better detection
        }
        
    def detect_people(self, frame: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Detect people in a frame
        Returns list of bounding boxes (x, y, width, height)
        """
        # Resize frame for faster processing
        height, width = frame.shape[:2]
        original_height, original_width = height, width
        max_width = 640
        scale_factor = 1.0
        if width > max_width:
            scale_factor = max_width / width
            frame = cv2.resize(frame, None, fx=scale_factor, fy=scale_factor)
        
        # Try detection with original frame first
        boxes, weights = self.hog.detectMultiScale(frame, **self.detection_params)
        
        # If no detections, try with enhanced contrast
        if len(boxes) == 0:
            # Enhance contrast
            lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
            l = clahe.apply(l)
            enhanced = cv2.merge([l,a,b])
            enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
            
            boxes, weights = self.hog.detectMultiScale(enhanced, **self.detection_params)
        
        # Scale boxes back to original size if we resized
        if scale_factor != 1.0 and len(boxes) > 0:
            boxes = boxes / scale_factor
            boxes = boxes.astype(int)
        
        # Apply non-maximum suppression to remove overlapping boxes
        boxes = self._apply_nms(boxes, weights, threshold=0.3)
        
        print(f"Detected {len(boxes)} people in frame", file=sys.stderr)
        
        return boxes
    
    def _apply_nms(self, boxes: np.ndarray, weights: np.ndarray, 
                   threshold: float = 0.3) -> List[Tuple[int, int, int, int]]:
        """Apply Non-Maximum Suppression to remove overlapping detections"""
        if len(boxes) == 0:
            return []
        
        # Convert to (x1, y1, x2, y2) format
        x1 = boxes[:, 0]
        y1 = boxes[:, 1]
        x2 = boxes[:, 0] + boxes[:, 2]
        y2 = boxes[:, 1] + boxes[:, 3]
        
        areas = (x2 - x1) * (y2 - y1)
        order = weights.flatten().argsort()[::-1]
        
        keep = []
        while len(order) > 0:
            i = order[0]
            keep.append(i)
            
            # Calculate IoU with remaining boxes
            xx1 = np.maximum(x1[i], x1[order[1:]])
            yy1 = np.maximum(y1[i], y1[order[1:]])
            xx2 = np.minimum(x2[i], x2[order[1:]])
            yy2 = np.minimum(y2[i], y2[order[1:]])
            
            w = np.maximum(0, xx2 - xx1)
            h = np.maximum(0, yy2 - yy1)
            
            intersection = w * h
            iou = intersection / (areas[i] + areas[order[1:]] - intersection)
            
            # Keep boxes with IoU less than threshold
            order = order[np.where(iou <= threshold)[0] + 1]
        
        return [tuple(boxes[i]) for i in keep]
    
    def point_in_zone(self, point: Tuple[int, int], zone: Dict) -> bool:
        """Check if a point is inside a zone (polygon)"""
        x, y = point
        vertices = zone['coordinates']
        
        # Ray casting algorithm
        inside = False
        j = len(vertices) - 1
        
        for i in range(len(vertices)):
            xi, yi = vertices[i]['x'], vertices[i]['y']
            xj, yj = vertices[j]['x'], vertices[j]['y']
            
            if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
                inside = not inside
            
            j = i
        
        return inside
    
    def auto_scale_zones(self, zones: List[Dict], frame_width: int, frame_height: int) -> List[Dict]:
        """
        Automatically scale zones if they're too small for the video frame.
        If zones are overlapping or identical, distribute them across the frame.
        """
        if not zones:
            return zones
        
        # Find max coordinates in zones
        max_x = max_y = 0
        min_x = min_y = float('inf')
        for zone in zones:
            for coord in zone['coordinates']:
                max_x = max(max_x, coord['x'])
                max_y = max(max_y, coord['y'])
                min_x = min(min_x, coord['x'])
                min_y = min(min_y, coord['y'])
        
        zone_width = max_x - min_x
        zone_height = max_y - min_y
        
        # If zones are tiny compared to frame (either dimension < 50% of frame size)
        if max_x < frame_width * 0.5 or max_y < frame_height * 0.5:
            # Check if all zones are identical (overlapping)
            all_identical = True
            if len(zones) > 1:
                first_coords = zones[0]['coordinates']
                for zone in zones[1:]:
                    if zone['coordinates'] != first_coords:
                        all_identical = False
                        break
            
            if all_identical and len(zones) > 1:
                # Distribute zones horizontally across the frame
                print(f"⚠️  Zones identical ({max_x}x{max_y})! Distributing {len(zones)} zones across {frame_width}x{frame_height} frame", file=sys.stderr)
                
                zone_width = frame_width // len(zones)
                scaled_zones = []
                
                for i, zone in enumerate(zones):
                    scaled_zone = zone.copy()
                    x_start = i * zone_width
                    x_end = (i + 1) * zone_width if i < len(zones) - 1 else frame_width
                    
                    # Create zone covering this horizontal section
                    scaled_zone['coordinates'] = [
                        {'x': x_start, 'y': 0},
                        {'x': x_end, 'y': 0},
                        {'x': x_end, 'y': frame_height},
                        {'x': x_start, 'y': frame_height}
                    ]
                    scaled_zones.append(scaled_zone)
                
                return scaled_zones
            else:
                # Scale zones uniformly while preserving relative positions
                scale_x = frame_width / max(max_x, 1)
                scale_y = frame_height / max(max_y, 1)
                scale = min(scale_x, scale_y)
                
                print(f"⚠️  Zones too small (max: {max_x}x{max_y})! Scaling by {scale:.2f}x to fit {frame_width}x{frame_height} frame", file=sys.stderr)
                
                scaled_zones = []
                for zone in zones:
                    scaled_zone = zone.copy()
                    scaled_zone['coordinates'] = [
                        {'x': int(coord['x'] * scale), 'y': int(coord['y'] * scale)}
                        for coord in zone['coordinates']
                    ]
                    scaled_zones.append(scaled_zone)
                
                return scaled_zones
        
        return zones
    
    def count_people_in_zones(self, boxes: List[Tuple[int, int, int, int]], 
                              zones: List[Dict]) -> Dict[str, int]:
        """
        Count people in each zone
        Returns dictionary with zone IDs and people counts
        """
        zone_counts = {zone['id']: 0 for zone in zones}
        
        # Debug: Log zone boundaries
        print(f"DEBUG: Checking {len(boxes)} detected people against {len(zones)} zones", file=sys.stderr)
        for zone in zones:
            coords = zone['coordinates']
            xs = [c['x'] for c in coords]
            ys = [c['y'] for c in coords]
            print(f"  Zone '{zone['name']}': x range [{min(xs)}-{max(xs)}], y range [{min(ys)}-{max(ys)}]", file=sys.stderr)
        
        for i, box in enumerate(boxes):
            x, y, w, h = box
            # Use center point of detection box
            center_x = x + w // 2
            center_y = y + h // 2
            
            # Debug: Log person position
            if i < 3:  # Only log first 3 people to avoid spam
                print(f"  Person {i+1}: center at ({center_x}, {center_y}), box: ({x}, {y}, {w}, {h})", file=sys.stderr)
            
            # Check which zone this person belongs to
            for zone in zones:
                if self.point_in_zone((center_x, center_y), zone):
                    zone_counts[zone['id']] += 1
                    break  # Person counted in first matching zone
        
        return zone_counts
    
    def process_video(self, video_path: str, zones: List[Dict], 
                     event_id: str, sample_interval: int = 15) -> List[Dict]:
        """
        Process video and extract crowd density data
        
        Args:
            video_path: Path to video file
            zones: List of zone definitions with coordinates
            event_id: Event identifier
            sample_interval: Seconds between samples (default 15)
        
        Returns:
            List of crowd density records
        """
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            raise ValueError(f"Cannot open video file: {video_path}")
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        # If no zones or zones are tiny, create a single full-frame zone
        if not zones or len(zones) == 0:
            print(f"⚠️  No zones defined. Creating default 'Full Video' zone covering entire frame.", file=sys.stderr)
            zones = [{
                'id': 'full-video-zone',
                'name': 'Full Video',
                'coordinates': [
                    {'x': 0, 'y': 0},
                    {'x': frame_width, 'y': 0},
                    {'x': frame_width, 'y': frame_height},
                    {'x': 0, 'y': frame_height}
                ],
                'maxCapacity': 10
            }]
        else:
            # Auto-scale zones if they're too small for the video
            zones = self.auto_scale_zones(zones, frame_width, frame_height)
        
        # Calculate frames to skip based on sample interval
        frames_per_sample = int(fps * sample_interval)
        
        density_records = []
        frame_count = 0
        
        print(f"Processing video: {video_path}", file=sys.stderr)
        print(f"Video dimensions: {frame_width}x{frame_height}", file=sys.stderr)
        print(f"FPS: {fps}, Total frames: {total_frames}", file=sys.stderr)
        print(f"Sampling every {sample_interval} seconds ({frames_per_sample} frames)", file=sys.stderr)
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Process frame at sample intervals
            if frame_count % frames_per_sample == 0:
                # Calculate video timestamp
                current_seconds = frame_count / fps
                video_timestamp = str(timedelta(seconds=int(current_seconds)))
                
                # Detect people
                boxes = self.detect_people(frame)
                
                # Count people in each zone
                zone_counts = self.count_people_in_zones(boxes, zones)
                
                # Log detection results
                total_people = sum(zone_counts.values())
                print(f"Frame {frame_count}: Detected {total_people} total people across all zones", file=sys.stderr)
                for zone_id, count in zone_counts.items():
                    if count > 0:
                        print(f"  - Zone {zone_id}: {count} people", file=sys.stderr)
                
                # Create records for each zone
                for zone in zones:
                    zone_id = zone['id']
                    people_count = zone_counts[zone_id]
                    
                    # Calculate density percentage with a realistic max capacity
                    # Use 10 as default for better visualization (2 people = 20%, 5 people = 50%, etc.)
                    max_capacity = zone.get('maxCapacity', 10)
                    density_percentage = min(100, (people_count / max_capacity) * 100)
                    
                    record = {
                        'eventId': event_id,
                        'zoneId': zone_id,
                        'zoneName': zone['name'],
                        'peopleCount': people_count,
                        'densityPercentage': round(density_percentage, 2),
                        'timestamp': datetime.now().isoformat(),
                        'videoTimestamp': video_timestamp,
                        'metadata': {
                            'frameNumber': frame_count,
                            'confidence': 0.85,  # Average confidence
                            'processingTime': 0
                        }
                    }
                    
                    density_records.append(record)
                
                print(f"Processed frame {frame_count}/{total_frames} at {video_timestamp}", file=sys.stderr)
            
            frame_count += 1
        
        cap.release()
        print(f"Processing complete. Generated {len(density_records)} records.", file=sys.stderr)
        
        return density_records

def main():
    """Main function to process video from command line"""
    if len(sys.argv) < 4:
        print("Usage: python crowd_analyzer.py <video_path> <zones_file> <event_id> [sample_interval]")
        sys.exit(1)
    
    video_path = sys.argv[1]
    zones_file = sys.argv[2]
    event_id = sys.argv[3]
    sample_interval = int(sys.argv[4]) if len(sys.argv) > 4 else 15
    
    # Read zones from file
    with open(zones_file, 'r') as f:
        zones = json.load(f)
    
    # Process video
    analyzer = CrowdAnalyzer()
    results = analyzer.process_video(video_path, zones, event_id, sample_interval)
    
    # Output results as JSON
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
