import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, AlertTriangle, TrendingUp, Clock, Upload, 
  Video, Activity, BarChart3, Camera, CheckCircle, 
  XCircle, Loader
} from 'lucide-react';
import { useEvent } from '../contexts/EventContext';
import MeshGradient from '../components/MeshGradient';
import Spotlight from '../components/Spotlight';
import Navbar from '../components/Navbar';
import crowdAnalysisService, { CrowdDensityData, ZoneStatistics } from '../services/crowdAnalysis.service';

const CrowdFlowAnalysis: React.FC = () => {
  const { event } = useEvent();
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [latestDensity, setLatestDensity] = useState<CrowdDensityData[]>([]);
  const [historicalData, setHistoricalData] = useState<CrowdDensityData[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [zoneStats, setZoneStats] = useState<ZoneStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [hasUploadedVideo, setHasUploadedVideo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-refresh latest data every 30 seconds (only after video upload)
  useEffect(() => {
    if (event && autoRefresh && hasUploadedVideo) {
      fetchLatestDensity();
      const interval = setInterval(fetchLatestDensity, 30000);
      return () => clearInterval(interval);
    }
  }, [event, autoRefresh, hasUploadedVideo]);

  // Fetch zone statistics when zone is selected
  useEffect(() => {
    if (event && selectedZone) {
      fetchZoneStatistics(selectedZone);
      fetchHistoricalData(selectedZone);
    }
  }, [event, selectedZone]);

  const fetchLatestDensity = async () => {
    if (!event?.id) return;
    
    try {
      const data = await crowdAnalysisService.getLatestDensity(event.id);
      setLatestDensity(data);
    } catch (error) {
      console.error('Failed to fetch latest density:', error);
    }
  };

  const fetchZoneStatistics = async (zoneId: string) => {
    if (!event?.id) return;
    
    try {
      const stats = await crowdAnalysisService.getZoneStatistics(event.id, zoneId);
      setZoneStats(stats);
    } catch (error) {
      console.error('Failed to fetch zone statistics:', error);
    }
  };

  const fetchHistoricalData = async (zoneId: string) => {
    if (!event?.id) return;
    
    try {
      const data = await crowdAnalysisService.getCrowdDensity(event.id, zoneId);
      setHistoricalData(data);
    } catch (error) {
      console.error('Failed to fetch historical data:', error);
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedVideo(e.target.files[0]);
      setUploadStatus('');
    }
  };

  const handleVideoUpload = async () => {
    if (!selectedVideo || !event?.id) return;

    setIsUploading(true);
    setUploadStatus('Uploading video...');

    try {
      const result = await crowdAnalysisService.uploadVideo(
        selectedVideo,
        event.id,
        'camera-1', // You can make this dynamic based on camera selection
        'Main Camera',
        5 // Sample every 5 seconds for faster results
      );

      setUploadStatus(`✅ ${result.message}`);
      setSelectedVideo(null);
      setHasUploadedVideo(true); // Enable live monitoring after successful upload
      
      // Refresh data immediately after processing
      await fetchLatestDensity();
      
      // Keep refreshing for 10 seconds to catch any delayed saves
      setTimeout(fetchLatestDensity, 2000);
      setTimeout(fetchLatestDensity, 5000);
      setTimeout(fetchLatestDensity, 10000);
    } catch (error: any) {
      setUploadStatus(`❌ Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const getDensityColor = (percentage: number) => {
    if (percentage >= 80) return 'text-red-500';
    if (percentage >= 60) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getDensityBgColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-red-500/20 border-red-500';
    if (percentage >= 60) return 'bg-yellow-500/20 border-yellow-500';
    return 'bg-green-500/20 border-green-500';
  };

  return (
    <div className="relative min-h-screen bg-ai-black text-ai-white overflow-hidden">
      <MeshGradient />
      <Spotlight />
      <Navbar />
      
      <div className="relative z-10 pt-24 pb-12">
        <div className="w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <Users className="w-16 h-16 mx-auto mb-4 text-ai-white" />
            <h1 className="text-heading text-4xl font-bold mb-4 text-ai-white">
              Crowd Flow Analysis
            </h1>
            <p className="text-ai-gray-400 text-lg max-w-2xl mx-auto">
              Real-time crowd monitoring using OpenCV-powered video analysis
            </p>
          </motion.div>

          {/* Video Upload Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-light rounded-2xl p-6 mb-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <Video className="w-6 h-6 text-ai-white" />
              <h3 className="text-xl font-semibold text-white">Upload Camera Footage</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full px-4 py-3 bg-ai-gray-700 hover:bg-ai-gray-600 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-5 h-5" />
                    {selectedVideo ? selectedVideo.name : 'Select Video File'}
                  </button>
                </div>
                
                <button
                  onClick={handleVideoUpload}
                  disabled={!selectedVideo || isUploading}
                  className="px-6 py-3 bg-ai-white text-ai-black rounded-xl hover:bg-ai-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Upload & Analyze
                    </>
                  )}
                </button>
              </div>

              {uploadStatus && (
                <div className={`p-3 rounded-lg ${
                  uploadStatus.includes('✅') 
                    ? 'bg-green-500/20 border border-green-500' 
                    : uploadStatus.includes('❌')
                    ? 'bg-red-500/20 border border-red-500'
                    : 'bg-blue-500/20 border border-blue-500'
                }`}>
                  <p className="text-sm">{uploadStatus}</p>
                </div>
              )}

              <div className="bg-ai-gray-800/50 rounded-lg p-4 text-sm">
                <p className="text-ai-gray-400 mb-2">
                  <strong>How it works:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 text-ai-gray-400">
                  <li>Upload video footage from your event cameras</li>
                  <li>OpenCV analyzes the video and detects people in each frame</li>
                  <li>Density data is extracted every 5 seconds for fast results</li>
                  <li>Results are stored with timestamps: "at 0:00:04 - 4 people in zone"</li>
                  <li>View real-time density percentages per zone below</li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Auto-refresh Toggle - Only show after video upload */}
          {hasUploadedVideo && (
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <Activity className="w-6 h-6" />
                Live Density Monitor
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-ai-gray-400">Auto-refresh (30s)</span>
              </label>
            </div>
          )}

          {/* Current Density Cards - Only show after video upload */}
          {hasUploadedVideo && latestDensity.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
            >
              {latestDensity.map((zone) => (
                <motion.div
                  key={zone._id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setSelectedZone(zone.zoneId)}
                  className={`glass-light rounded-2xl p-6 border-2 cursor-pointer transition-all ${
                    selectedZone === zone.zoneId 
                      ? 'border-ai-white' 
                      : 'border-transparent hover:border-ai-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Camera className="w-5 h-5 text-ai-white" />
                      <h4 className="text-lg font-semibold text-white">{zone.zoneName}</h4>
                    </div>
                    <div className={`text-3xl font-bold ${getDensityColor(zone.densityPercentage)}`}>
                      {Math.round(zone.densityPercentage)}%
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="w-full bg-ai-gray-700 rounded-full h-3">
                      <motion.div
                        className={`h-3 rounded-full ${
                          zone.densityPercentage >= 80 ? 'bg-red-500' :
                          zone.densityPercentage >= 60 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(zone.densityPercentage, 100)}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-ai-gray-400">People Count:</span>
                      <span className="font-semibold text-ai-white">{zone.peopleCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ai-gray-400">Video Time:</span>
                      <span className="font-semibold text-ai-white">{zone.videoTimestamp}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ai-gray-400">Updated:</span>
                      <span className="font-semibold text-ai-white">
                        {new Date(zone.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {zone.cameraName && (
                      <div className="flex items-center justify-between">
                        <span className="text-ai-gray-400">Camera:</span>
                        <span className="font-semibold text-ai-white">{zone.cameraName}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : hasUploadedVideo ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-light rounded-2xl p-12 text-center mb-8"
            >
              <Loader className="w-16 h-16 mx-auto mb-4 text-ai-gray-400 animate-spin" />
              <p className="text-ai-gray-400 text-lg mb-2">Processing video data...</p>
              <p className="text-ai-gray-500 text-sm">
                Please wait while we analyze the crowd density from your video
              </p>
            </motion.div>
          ) : null}

          {/* Zone Statistics */}
          {selectedZone && zoneStats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-light rounded-2xl p-6 mb-8"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-6 h-6 text-ai-white" />
                  <h3 className="text-xl font-semibold text-white">
                    {zoneStats.zoneName} - Detailed Statistics
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setSelectedZone(null);
                    setZoneStats(null);
                  }}
                  className="text-ai-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-ai-gray-800/50 rounded-xl p-4">
                  <div className="text-ai-gray-400 text-sm mb-2">Average Density</div>
                  <div className="text-2xl font-bold text-white">
                    {Math.round(zoneStats.avgDensity)}%
                  </div>
                </div>
                <div className="bg-ai-gray-800/50 rounded-xl p-4">
                  <div className="text-ai-gray-400 text-sm mb-2">Peak Density</div>
                  <div className="text-2xl font-bold text-red-500">
                    {Math.round(zoneStats.maxDensity)}%
                  </div>
                </div>
                <div className="bg-ai-gray-800/50 rounded-xl p-4">
                  <div className="text-ai-gray-400 text-sm mb-2">Avg People</div>
                  <div className="text-2xl font-bold text-white">
                    {Math.round(zoneStats.avgPeopleCount)}
                  </div>
                </div>
                <div className="bg-ai-gray-800/50 rounded-xl p-4">
                  <div className="text-ai-gray-400 text-sm mb-2">Data Points</div>
                  <div className="text-2xl font-bold text-white">
                    {zoneStats.dataPoints}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Historical Timeline */}
          {selectedZone && historicalData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-light rounded-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <Clock className="w-6 h-6 text-ai-white" />
                <h3 className="text-xl font-semibold text-white">Density Timeline</h3>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {historicalData.map((data, index) => (
                  <div
                    key={data._id}
                    className="flex items-center gap-4 p-3 bg-ai-gray-800/50 rounded-lg"
                  >
                    <div className="flex-shrink-0 w-24 text-sm text-ai-gray-400">
                      {data.videoTimestamp}
                    </div>
                    <div className="flex-1">
                      <div className="w-full bg-ai-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            data.densityPercentage >= 80 ? 'bg-red-500' :
                            data.densityPercentage >= 60 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(data.densityPercentage, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex-shrink-0 w-20 text-right">
                      <span className={`font-semibold ${getDensityColor(data.densityPercentage)}`}>
                        {Math.round(data.densityPercentage)}%
                      </span>
                    </div>
                    <div className="flex-shrink-0 w-16 text-right text-sm text-ai-gray-400">
                      {data.peopleCount} people
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CrowdFlowAnalysis;