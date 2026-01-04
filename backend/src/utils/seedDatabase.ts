import bcrypt from 'bcryptjs';
import { User } from '../models/user.model';

export const seedTestUser = async (): Promise<void> => {
  try {
    // Check if test user already exists
    const existingUser = await User.findOne({ email: 'test@gmail.com' });
    
    if (existingUser) {
      console.log('✅ Test user already exists in database');
      return;
    }

    // Create test user with password: Test@123
    const hashedPassword = await bcrypt.hash('Test@123', 10);
    
    const testUser = new User({
      name: 'Test User',
      email: 'test@gmail.com',
      password: hashedPassword,
      role: 'organizer',
    });

    await testUser.save();
    console.log('✅ Test user seeded successfully: test@gmail.com / Test@123');
  } catch (error: any) {
    console.error('❌ Error seeding test user:', error.message);
  }
};
