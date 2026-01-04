import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'organizer' | 'participant' | 'admin';
  organization?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Email validation function
const validateGmail = (email: string): boolean => {
  return email.endsWith('@gmail.com');
};

// Password validation function
const validatePassword = (password: string): boolean => {
  // Minimum 8 characters, at least one uppercase, one number, and one special character
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  return minLength && hasUppercase && hasNumber && hasSpecialChar;
};

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: validateGmail,
        message: 'Email must be a Gmail address (@gmail.com)',
      },
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long'],
      validate: {
        validator: validatePassword,
        message: 'Password must contain at least one uppercase letter, one number, and one special character',
      },
    },
    role: {
      type: String,
      enum: ['organizer', 'participant', 'admin'],
      default: 'participant',
    },
    organization: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUser>('User', userSchema);
