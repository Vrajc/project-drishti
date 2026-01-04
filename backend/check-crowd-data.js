import { MongoClient } from 'mongodb';

async function checkCrowdData() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('drishti-event-safety');
    const collection = db.collection('crowddensities');
    
    // Get total count
    const totalCount = await collection.countDocuments();
    console.log(`\n📊 Total crowd density records: ${totalCount}`);
    
    // Get latest 10 records
    const latestRecords = await collection
      .find()
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();
    
    console.log('\n📋 Latest 10 records:');
    latestRecords.forEach((record, index) => {
      console.log(`\n${index + 1}. Zone: ${record.zoneName}`);
      console.log(`   Event ID: ${record.eventId}`);
      console.log(`   People Count: ${record.peopleCount}`);
      console.log(`   Density: ${record.densityPercentage.toFixed(2)}%`);
      console.log(`   Video Time: ${record.videoTimestamp}`);
      console.log(`   Timestamp: ${record.timestamp}`);
    });
    
    // Get records grouped by zone
    const zoneGroups = await collection.aggregate([
      {
        $group: {
          _id: '$zoneName',
          count: { $sum: 1 },
          avgPeople: { $avg: '$peopleCount' },
          avgDensity: { $avg: '$densityPercentage' },
          maxPeople: { $max: '$peopleCount' }
        }
      }
    ]).toArray();
    
    console.log('\n📊 Data by Zone:');
    zoneGroups.forEach(zone => {
      console.log(`\n  Zone: ${zone._id}`);
      console.log(`    Records: ${zone.count}`);
      console.log(`    Avg People: ${zone.avgPeople.toFixed(2)}`);
      console.log(`    Max People: ${zone.maxPeople}`);
      console.log(`    Avg Density: ${zone.avgDensity.toFixed(2)}%`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkCrowdData();
