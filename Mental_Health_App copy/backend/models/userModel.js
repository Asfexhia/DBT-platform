import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address.']
  },
  name: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Non Binary'],
    required: true
  },
  age: {
    type: Number,
    required: true,
    min: 0
  },
  bio: {
    type: String,
    default: ''
  },
  profilePicture: {
    type: String, // This will store the file path
    default: ''
  },
  // Counters for Coze usage
  // `test_result` represents user's current level
  // `train_result` represents user's current experience points
  test_result: {
    type: Number,
    default: 0
  },
  train_result: {
    type: Number,
    default: 0
  },
  // Achievement system fields
  totalTrainingCount: {
    type: Number,
    default: 0
  },
  testFailureCount: {
    type: Number,
    default: 0
  },
  consecutiveLoginDays: {
    type: Number,
    default: 0
  },
  lastLoginDate: {
    type: Date,
    default: null
  },
  achievements: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Achievement'
  }],
  journals: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Journal'
  }]
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const User = mongoose.model('User', userSchema);
export default User;
